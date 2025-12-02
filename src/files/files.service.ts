import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MssqlService } from '@strongnguyen/nestjs-mssql';
import { DynamicDatabaseService } from '../database/dynamic-database.service';
import { UsersService } from '../users/users.service';
import { ActivitiesService } from '../activities/activities.service';
import * as FileInterfaces from './interfaces/files.interface';

export interface DocumentoConMetadatos {
  claveDocumento: string;
  nombreArchivo: string;
  tipoDocumento: string;
  fechaGeneracion: Date;
  contenido: FileInterfaces.GeneratedFile;
}

interface Expediente {
  claveExpediente: string;
  añoGeneracion: number;
  claveDocente: string;
  documentos: DocumentoConMetadatos[];
}

type Generator = (
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number
) => Promise<FileInterfaces.GeneratedFile[]>;

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly mssql: MssqlService,
    private readonly dynamicDb: DynamicDatabaseService,
    private readonly usersService: UsersService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async generateFiles(
    claveUsuario: string
  ): Promise<DocumentoConMetadatos[]> {
    try {
      this.logger.log(`Iniciando generación de archivos para usuario: ${claveUsuario}`);
      
      // Verificar que el usuario existe
      const user = await this.usersService.findByClaveUsuario(claveUsuario);
      if (!user) {
        throw new NotFoundException(`Usuario con clave ${claveUsuario} no encontrado`);
      }
      this.logger.log(`Usuario encontrado: ${user.correo}`);

      const claveDocente = await this.getProfessorId(claveUsuario);
      if (!claveDocente) {
        throw new NotFoundException(`Docente con clave de usuario ${claveUsuario} no encontrado`);
      }
      this.logger.log(`Docente encontrado: ${claveDocente}`);
      
      const data = await this.generateExpediente(claveDocente);
      return data.documentos;

    } catch (error) {
      this.logger.error(`Error en generateFiles: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generar expediente en MODO DE PRUEBA
   * No genera documentos reales, solo simula el flujo y hace los inserts necesarios
   * @param claveDocente string
   * @param testMode boolean - Activar modo de prueba (default: true para testing)
   */
  async generateExpediente(
      claveDocente: string,
      testMode: boolean = false
  ): Promise<Expediente> {
    this.logger.log(`[GENERATE_EXPEDIENTE] ====== INICIANDO GENERACIÓN DE EXPEDIENTE ======`);
    
    if (testMode) {
        this.logger.warn(`[GENERATE_EXPEDIENTE] 🧪 MODO DE PRUEBA ACTIVADO - No se generarán documentos reales`);
    }
    
    this.logger.log(`[GENERATE_EXPEDIENTE] Clave Docente: ${claveDocente}`);
    
    const añoGeneracion = new Date().getFullYear();
    const año = añoGeneracion - 1;
    const claveExpediente = `${claveDocente}-${añoGeneracion}`;
    
    this.logger.log(`[GENERATE_EXPEDIENTE] Año de generación: ${añoGeneracion}`);
    this.logger.log(`[GENERATE_EXPEDIENTE] Clave de expediente: ${claveExpediente}`);
    
    // Eliminar expediente existente
    this.logger.log(`[GENERATE_EXPEDIENTE] Verificando si existe expediente anterior...`);
    await this.deleteExpedienteIfExists(claveExpediente);
    
    let claveDepartamento: string;
    let base;
    let documentos: DocumentoConMetadatos[] = [];
    
    const generation: Record<string, Generator> = {
        // DOC001: Horarios
        'DOC001': () =>
        this.generateHorariosAsignaturas(base, claveDocente, claveDepartamento, año),

        // DOC002: Constancia de asignaturas impartidas
        'DOC002': () =>
        this.generateConstanciaAsignaturas(base, claveDocente, claveDepartamento, año),

        // DOC008: Constancia de tutorías PIT
        'DOC008': () =>
        this.generateTutorias(base, claveDocente, claveDepartamento, año),

        // DOC009: Constancia de acreditación de programas
        'DOC009': () =>
        this.generateAcreditacionProgramas(base, claveDocente, claveDepartamento),

        // DOC010: Constancia de actividades complementarias
        'DOC010': () =>
        this.generateActividadesComplementarias(base, claveDocente, claveDepartamento, año),

        // DOC011: Constancia de proyecto integrador
        'DOC011': () =>
        this.generateProyectoIntegrador(base, claveDocente, claveDepartamento, año),

        // DOC012: Constancia manual de prácticas
        'DOC012': () =>
        this.generateConstanciasElaboracionMaterial(base, claveDocente, claveDepartamento, año, 'manual'),

        // DOC013: Constancia estrategias didácticas
        'DOC013': () =>
        this.generateConstanciasElaboracionMaterial(base, claveDocente, claveDepartamento, año, 'estrategias'),

        // DOC014: Constancia materiales didácticos inclusivos
        'DOC014': () =>
        this.generateConstanciasElaboracionMaterial(base, claveDocente, claveDepartamento, año, 'materiales'),

        // DOC015: Comisión por instructor de cursos para docentes
        'DOC015': () =>
        this.generateCursosImpartidos(base, claveDocente, claveDepartamento, año,
            { tipo: 'comision', origen: 'tecnológico'}),

        // DOC016: Constancia por instructor de cursos para docentes
        'DOC016': () =>
        this.generateCursosImpartidos(base, claveDocente, claveDepartamento, año,
            { tipo: 'constancia', origen: 'tecnológico'}),

        // DOC017: Comisión por instructor de cursos TecNM
        'DOC017': () =>
        this.generateCursosImpartidos(base, claveDocente, claveDepartamento, año,
            { tipo: 'comision', origen: 'tecnm'}),

        // DOC018: Constancia por instructor de cursos TecNM
        'DOC018': () =>
        this.generateCursosImpartidos(base, claveDocente, claveDepartamento, año,
            { tipo: 'constancia', origen: 'tecnm'}),

        // DOC019: Comisión por instructor de diplomados
        'DOC019': () =>
        this.generateDiplomados(base, claveDocente, claveDepartamento, año, 'comision'),

        // DOC020: Constancia por instructor de diplomados
        'DOC020': () =>
        this.generateDiplomados(base, claveDocente, claveDepartamento, año, 'constancia'),

        // DOC026: Comisión diplomados estrategicos
        'DOC026': () =>
        this.generateDiplomadosEstrategicos(base, claveDocente, claveDepartamento, año, 'comision'),

        // DOC027: Constancia diplomados estrategicos
        'DOC027': () =>
        this.generateDiplomadosEstrategicos(base, claveDocente, claveDepartamento, año, 'constancia'),

        // DOC028: Acta de examen de titulación
        'DOC028': () =>
        this.generateTitulaciones(base, claveDocente, claveDepartamento, año, 'acta'),

        // DOC030: Constancia sinodal titulación
        'DOC030': () =>
        this.generateTitulaciones(base, claveDocente, claveDepartamento, año, 'constancia'),

        // DOC029: Convenio de colaboración
        'DOC029': () =>
        this.generateConveniosAcademicos(base, claveDocente, claveDepartamento, año),

        // DOC031: Programa de asesorías en ciencias básicas
        'DOC031': () =>
        this.generateAsesoriasCienciasBasicas(base, claveDocente, claveDepartamento, año),

        // DOC032: Constancia de asesorías en ciencias básicas
        'DOC032': () =>
        this.generateConstanciaAsesoriaCienciasBasicas(base, claveDocente, claveDepartamento, año),

        // DOC033: Comisión por asesoría en concursos
        'DOC033': () => 
        this.generateAsesoriaConcursos(base, claveDocente, claveDepartamento, año, 
            { tipo: 'comision', premiado: false }),
        
        // DOC034: Constancia por asesoría en concursos
        'DOC034': () => 
        this.generateAsesoriaConcursos(base, claveDocente, claveDepartamento, año, 
            { tipo: 'constancia', premiado: false }),
        
        // DOC035: Comisión por asesoría en proyectos premiados en concurso
        'DOC035': () => 
        this.generateAsesoriaConcursos(base, claveDocente, claveDepartamento, año, 
            { tipo: 'comision', premiado: true }),
        
        // DOC036: Constancia por asesoría en proyectos premiados en concurso
        'DOC036': () => 
        this.generateAsesoriaConcursos(base, claveDocente, claveDepartamento, año, 
            { tipo: 'constancia', premiado: true }),
        
        // DOC037: Comisión por colaboración en eventos
        'DOC037': () => 
        this.generateColaboracionEventos(base, claveDocente, claveDepartamento, año, 'comision'),
        
        // DOC038: Constancia por colaboración en eventos
        'DOC038': () => 
        this.generateColaboracionEventos(base, claveDocente, claveDepartamento, año, 'constancia'),
        
        // DOC039: Comisión para participar como jurado en eventos
        'DOC039': () => 
        this.generateJuradoEventos(base, claveDocente, claveDepartamento, año, 'comision'),
        
        // DOC040: Constancia para participar como jurado en eventos
        'DOC040': () => 
        this.generateJuradoEventos(base, claveDocente, claveDepartamento, año, 'constancia'),
        
        // DOC041: Comisión para participar en comités de evaluación
        'DOC041': () => 
        this.generateComitesEvaluacion(base, claveDocente, claveDepartamento, año, 'comision'),
        
        // DOC042: Constancia para participar en comités de evaluación
        'DOC042': () => 
        this.generateComitesEvaluacion(base, claveDocente, claveDepartamento, año, 'constancia'),
        
        // DOC043: Comisión para auditorías
        'DOC043': () => 
        this.generateAuditorias(base, claveDocente, claveDepartamento, año, 'comision'),
        
        // DOC044: Constancia para auditorías
        'DOC044': () => 
        this.generateAuditorias(base, claveDocente, claveDepartamento, año, 'constancia'),
        
        // DOC045: Comisión para elaboración de planes y programas
        'DOC045': () => 
        this.generateElaboracionPlanes(base, claveDocente, claveDepartamento, año, 
            { tipo: 'comision', nivel: 'null' }),
        
        // DOC046: Constancia para elaboración de planes y programas (local)
        'DOC046': () => 
        this.generateElaboracionPlanes(base, claveDocente, claveDepartamento, año, 
            { tipo: 'constancia', nivel: 'local' }),
        
        // DOC047: Constancia para elaboración de planes y programas (nacional)
        'DOC047': () => 
        this.generateElaboracionPlanes(base, claveDocente, claveDepartamento, año, 
            { tipo: 'constancia', nivel: 'nacional' }),
        
        // DOC048: Comisión para la elaboración de módulos de especialidad
        'DOC048': () => 
        this.generateElaboracionModulos(base, claveDocente, claveDepartamento, año, 'comision'),
        
        // DOC049: Registro de modulos de especialidad
        'DOC049': () => 
        this.generateElaboracionModulos(base, claveDocente, claveDepartamento, año, 'registro'),
        
        // DOC050: Constancia por la elaboracion de modulos de especialidad
        'DOC050': () => 
        this.generateElaboracionModulos(base, claveDocente, claveDepartamento, año, 'constancia'),
        
        // DOC051: Comisión para la apertura de programas
        'DOC051': () => 
        this.generateAperturaProgramas(base, claveDocente, claveDepartamento, año, 'comision'),
        
        // DOC052: Constancia para la apertura de programas
        'DOC052': () => 
        this.generateAperturaProgramas(base, claveDocente, claveDepartamento, año, 'constancia'),
        
        // DOC053: Autorización para la apertura de programas
        'DOC053': () => 
        this.generateAperturaProgramas(base, claveDocente, claveDepartamento, año, 'autorizacion'),
        
        // DOC054: Constancia de prestación de servicios docentes
        'DOC054': () => 
        this.generatePrestacionServicios(base, claveDocente, claveDepartamento),
        
        // DOC055: Carta de exclusividad laboral
        'DOC055': () => 
        this.generatePrestacionServicios(base, claveDocente, claveDepartamento),
        
        // DOC056: Constancia de proyecto de investigación vigente
        'DOC056': () => 
        this.generateProyectoInvestigacion(base, claveDocente, claveDepartamento, año),
        
        // DOC057: Curriculum vitae
        'DOC057': () => 
        this.generateCurriculumVitae(base, claveDocente, claveDepartamento),
        
        // DOC058: Licencias especiales
        'DOC058': () => 
        this.generateLicenciasEspeciales(base, claveDocente, claveDepartamento, año),
        
        // DOC059: Constancias de cumplimiento de actividades
        'DOC059': () => 
        this.generateCumplimientoActividades(base, claveDocente, claveDepartamento, año, 'semestre'),
        
        // DOC060: Carta de liberación de actividades
        'DOC060': () => 
        this.generateCumplimientoActividades(base, claveDocente, claveDepartamento, año, 'anual'),
        
        // DOC061: Evaluación departamental nivel licenciatura
        'DOC061': () => 
        this.generateEvaluaciones(base, claveDocente, claveDepartamento, año, 'departamental'),
        
        // DOC062: Evaluación departamental nivel posgrado
        'DOC062': () => 
        this.generateEvaluaciones(base, claveDocente, claveDepartamento, año, 'departamental'),
        
        // DOC063: Evaluación de desempeño docente
        'DOC063': () => 
        this.generateEvaluaciones(base, claveDocente, claveDepartamento, año, 'desempeño'),
    };

    this.logger.log(`[GENERATE_EXPEDIENTE] Total de tipos de documentos disponibles: ${Object.keys(generation).length}`);

    // Obtener todos los departamentos
    this.logger.log(`[GENERATE_EXPEDIENTE] Obteniendo lista de departamentos...`);
    let departamentos;
    try {
        departamentos = await this.getAllDepartmentIds();
        this.logger.log(`[GENERATE_EXPEDIENTE] Departamentos obtenidos: ${departamentos?.length || 0}`);
        if (departamentos && departamentos.length > 0) {
        this.logger.log(`[GENERATE_EXPEDIENTE] IDs de departamentos: ${JSON.stringify(departamentos)}`);
        }
    } catch (error) {
        this.logger.error(`[GENERATE_EXPEDIENTE] Error al obtener departamentos:`, error);
        departamentos = [];
    }
    
    // Procesar cada departamento
    this.logger.log(`[GENERATE_EXPEDIENTE] Iniciando procesamiento por departamentos...`);
    let departamentosProcesados = 0;
    let totalDocumentosGenerados = 0;
    
    for (const dep of departamentos) {
        departamentosProcesados++;
        this.logger.log(`[GENERATE_EXPEDIENTE] ===== Procesando departamento ${departamentosProcesados}/${departamentos.length} =====`);
        
        try {
            claveDepartamento = dep ?? (await this.getDepartmentByProfessorId(claveDocente));
            this.logger.log(`[GENERATE_EXPEDIENTE] Clave departamento: ${claveDepartamento}`);
            
            if (testMode) {
                // MODO DE PRUEBA: No generar documentos, solo simular
                this.logger.log(`[GENERATE_EXPEDIENTE] 🧪 Saltando generación real de documentos (modo prueba)`);
                this.logger.log(`[GENERATE_EXPEDIENTE] ✅ Simulado procesamiento del departamento ${claveDepartamento}`);
                continue; // Saltar a siguiente departamento sin generar
            }
            
            // MODO NORMAL: Generar documentos reales
            this.logger.log(`[GENERATE_EXPEDIENTE] Llamando a getFilesByDepartment...`);
            const result = await this.getFilesByDepartment(claveDocente, claveDepartamento, año, generation);
            
            if (result && result.length > 0) {
                documentos.push(...result);
                totalDocumentosGenerados += result.length;
                this.logger.log(`[GENERATE_EXPEDIENTE] ✅ Generados ${result.length} documentos del departamento ${claveDepartamento}`);
                
                // Log detallado de los documentos generados
                for (let index = 0; index < result.length; index++) {
                    const doc = result[index];
                    let nombreDocumento = 'Sin nombre';
                    
                    try {
                        // Intentar obtener el nombre del documento desde la BD
                        if (doc.claveDocumento) {
                        const nombre = await this.getDocumentNameById(doc.claveDocumento);
                        nombreDocumento = nombre || `${doc.claveDocumento} (sin nombre en BD)`;
                        }
                    } catch (error) {
                        this.logger.warn(`[GENERATE_EXPEDIENTE] No se pudo obtener nombre para documento ${doc.claveDocumento}`);
                        nombreDocumento = doc.claveDocumento || 'Sin clave';
                    }
                    
                    this.logger.log(`[GENERATE_EXPEDIENTE]   - Documento ${index + 1}: ${nombreDocumento}`);
                }
            } else {
                this.logger.warn(`[GENERATE_EXPEDIENTE] ⚠️ No se generaron documentos para el departamento ${claveDepartamento}`);
            }
        } catch (error) {
            this.logger.error(`[GENERATE_EXPEDIENTE] ❌ Error procesando departamento ${dep}:`, error);
            this.logger.error(`[GENERATE_EXPEDIENTE] Stack trace:`, error.stack);
        }
    }
    
    this.logger.log(`[GENERATE_EXPEDIENTE] ===== RESUMEN DE GENERACIÓN =====`);
    this.logger.log(`[GENERATE_EXPEDIENTE] Departamentos procesados: ${departamentosProcesados}`);
    
    if (testMode) {
        this.logger.log(`[GENERATE_EXPEDIENTE] 🧪 MODO PRUEBA: 0 documentos generados (esperado)`);
    } else {
        this.logger.log(`[GENERATE_EXPEDIENTE] Total de documentos generados: ${totalDocumentosGenerados}`);
    }
    
    this.logger.log(`[GENERATE_EXPEDIENTE] Documentos en array final: ${documentos.length}`);
    
    // Crear objeto expediente
    const expediente: Expediente = {
        claveExpediente: claveExpediente,
        añoGeneracion: añoGeneracion,
        claveDocente: claveDocente,
        documentos: documentos
    };
    
    this.logger.log(`[GENERATE_EXPEDIENTE] Expediente creado:`, {
        claveExpediente: expediente.claveExpediente,
        añoGeneracion: expediente.añoGeneracion,
        claveDocente: expediente.claveDocente,
        totalDocumentos: expediente.documentos.length
    });
    
    // Insertar expediente en base de datos
    try {
        this.logger.log(`[GENERATE_EXPEDIENTE] Insertando expediente en base de datos...`);
        await this.insertExpediente(expediente);
        this.logger.log(`[GENERATE_EXPEDIENTE] ✅ Expediente insertado exitosamente`);
    } catch (error) {
        this.logger.error(`[GENERATE_EXPEDIENTE] ❌ Error al insertar expediente:`, error);
        throw error;
    }
    
    // Insertar documentos generados (si hay)
    if (documentos.length > 0) {
        try {
            this.logger.log(`[GENERATE_EXPEDIENTE] Insertando ${documentos.length} documentos en base de datos...`);
            await this.insertGeneratedDocuments(documentos, claveExpediente);
        this.logger.log(`[GENERATE_EXPEDIENTE] ✅ Documentos insertados exitosamente`);
        } catch (error) {
            this.logger.error(`[GENERATE_EXPEDIENTE] ❌ Error al insertar documentos:`, error);
            throw error;
        }
    } else {
        if (testMode) {
            this.logger.log(`[GENERATE_EXPEDIENTE] 🧪 MODO PRUEBA: No hay documentos para insertar (esperado)`);
        } else {
            this.logger.warn(`[GENERATE_EXPEDIENTE] ⚠️ No hay documentos para insertar`);
        }
    }
    
    this.logger.log(`[GENERATE_EXPEDIENTE] ====== GENERACIÓN DE EXPEDIENTE COMPLETADA ======`);
    this.logger.log(`[GENERATE_EXPEDIENTE] Resultado final:`, {
        modoPrueba: testMode,
        claveExpediente: expediente.claveExpediente,
        documentosGenerados: expediente.documentos.length,
        exitoso: testMode ? true : expediente.documentos.length > 0
    });
    
    return expediente;
  }
 
  /**
  * Obtener documentos por departamento
  * @param claveDepartamento string
  * @param año number
  * @param claveDocente string
  */
  async getFilesByDepartment(
    claveDocente: string, 
    claveDepartamento: string, 
    año: number, 
    generation: Record<string, Generator>
    ): Promise<DocumentoConMetadatos[]> {
    try {
        this.logger.log(`[GET_FILES_BY_DEPT] Iniciando para departamento: ${claveDepartamento}`);
        
        const base: FileInterfaces.Base = {
        docente: {
            ...(await this.getProfessorDetails(claveDocente)),
            nombreCompleto: await this.getProfessorNameById(claveDocente)
        },
        titular: await this.getDepartmentHeadById(claveDepartamento),
        departamento: await this.getDepartmentNameById(claveDepartamento),
        claveDepartamento: claveDepartamento,
        };
        
        this.logger.log(`[GET_FILES_BY_DEPT] Base creada:`, JSON.stringify(base));
        
        const documentKeys = await this.getDocumentsByDepartment(claveDepartamento);
        const docs: DocumentoConMetadatos[] = [];
        
        for (const claveDocumento of documentKeys) {
            try {
                if (!generation[claveDocumento]) {
                    this.logger.warn(`[GET_FILES_BY_DEPT] No existe generador para: ${claveDocumento}`);
                        continue;
                    }
                    
                    const generatorResult = await generation[claveDocumento](base, claveDocente, claveDepartamento, año);
                    
                    const resultArray = Array.isArray(generatorResult) ? generatorResult : [generatorResult];
                    
                    if (resultArray.length > 0) {
                    const nombreDocumento = await this.getDocumentNameById(claveDocumento);
                    
                    const wrappedResults = resultArray.map((doc, index) => {
                        const contenidoCompleto = Object.assign(
                        {}, 
                        {
                            docente: base.docente,
                            titular: base.titular,
                            departamento: base.departamento,
                            claveDepartamento: base.claveDepartamento,
                        },
                            doc as object
                        );
                        
                        return {
                            claveDocumento: claveDocumento,
                            nombreArchivo: `${claveDocumento}_${claveDocente}_${index + 1}_${Date.now()}.pdf`,
                            tipoDocumento: nombreDocumento || `Documento ${claveDocumento}`,
                            fechaGeneracion: new Date(),
                            contenido: contenidoCompleto
                        };
                    });
                    
                    docs.push(...wrappedResults);
                    this.logger.log(`[GET_FILES_BY_DEPT] ✅ Generados ${wrappedResults.length} archivos para ${claveDocumento}`);
                } else {
                    this.logger.warn(`[GET_FILES_BY_DEPT] ⚠️ Sin resultados para ${claveDocumento}`);
                }
            } catch (error) {
                this.logger.error(`[GET_FILES_BY_DEPT] Error generando ${claveDocumento}:`, error);
            }
        }
        
        this.logger.log(`[GET_FILES_BY_DEPT] Total documentos generados: ${docs.length}`);
        return docs;
        
    } catch (error) {
        this.logger.error(`[GET_FILES_BY_DEPT] Error general:`, error);
        throw error;
    }
  }

  /**
 * Obtener expedientes por clave de usuario
 * @param claveUsuario string
 * @returns Array de expedientes con información completa
 */
  async getExpedientesByClaveUsuario(claveUsuario: string) {
    try {
        const user = await this.usersService.findByClaveUsuario(claveUsuario);
        
        if (!user) {
        throw new NotFoundException(`Usuario con clave ${claveUsuario} no encontrado`);
        }
        
        if (user.tipoUsuario !== 'DOCENTE' || !user.docente?.claveDocente) {
        this.logger.warn(`Usuario ${claveUsuario} no es docente o no tiene claveDocente`);
        return [];
        }
        
        const claveDocente = user.docente.claveDocente;
        this.logger.log(`Obteniendo expedientes para docente: ${claveDocente}`);
        
        const pool = this.mssql.getPool();
        const result = await pool
        .request()
        .input('ClaveDocente', claveDocente)
        .query(`
            SELECT 
            e.ClaveExpediente,
            e.AñoGeneracion,
            e.ClaveDocente,
            -- Información del docente
            d.Nombre AS NombreDocente,
            d.ApellidoPaterno,
            d.ApellidoMaterno,
            -- Contar documentos asociados
            (
                SELECT COUNT(*) 
                FROM DocumentoGenerado dg 
                WHERE dg.ClaveExpediente = e.ClaveExpediente
            ) AS TotalDocumentos
            FROM Expediente e
            INNER JOIN Docente d ON e.ClaveDocente = d.ClaveDocente
            WHERE e.ClaveDocente = @ClaveDocente
            ORDER BY e.AñoGeneracion DESC
        `);
        
        const expedientes = result.recordset.map(exp => ({
        claveExpediente: exp.ClaveExpediente,
        añoGeneracion: exp.AñoGeneracion,
        claveDocente: exp.ClaveDocente,
        nombreDocente: `${exp.NombreDocente} ${exp.ApellidoPaterno} ${exp.ApellidoMaterno}`.trim(),
        totalDocumentos: exp.TotalDocumentos || 0,
        claveUsuario: claveUsuario,
        departamento: user.docente.departamento
        }));
        
        this.logger.log(`Se encontraron ${expedientes.length} expedientes para el usuario ${claveUsuario}`);
        return expedientes;
        
    } catch (error) {
        this.logger.error(`Error al obtener expedientes para usuario ${claveUsuario}:`, error);
        throw error;
    }
  }

  /**
 * Obtener documentos generados de un expediente
 * @param claveExpediente string
 * @returns Array de documentos generados con información completa
 */
  async getDocumentosByExpediente(claveExpediente: string) {
    try {
        this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE] ====== INICIANDO BÚSQUEDA ======`);
        this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE] ClaveExpediente: ${claveExpediente}`);

        const pool = this.mssql.getPool();
        
        // Primero verificar que el expediente existe
        const expedienteCheck = await pool
        .request()
        .input('ClaveExpediente', claveExpediente)
        .query(`
            SELECT 
            e.ClaveExpediente,
            e.AñoGeneracion,
            e.ClaveDocente,
            d.Nombre + ' ' + d.ApellidoPaterno + ' ' + d.ApellidoMaterno AS NombreDocente
            FROM Expediente e
            INNER JOIN Docente d ON e.ClaveDocente = d.ClaveDocente
            WHERE e.ClaveExpediente = @ClaveExpediente
        `);

        if (!expedienteCheck.recordset[0]) {
        this.logger.warn(`[GET_DOCUMENTOS_EXPEDIENTE] ⚠️ Expediente no encontrado: ${claveExpediente}`);
        throw new NotFoundException(`Expediente con clave ${claveExpediente} no encontrado`);
        }

        const expediente = expedienteCheck.recordset[0];
        this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE] Expediente encontrado:`);
        this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE]   - Año: ${expediente.AñoGeneracion}`);
        this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE]   - Docente: ${expediente.NombreDocente}`);

        // Obtener documentos generados
        this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE] Obteniendo documentos generados...`);
        
        const result = await pool
        .request()
        .input('ClaveExpediente', claveExpediente)
        .query(`
            SELECT 
                dg.ClaveDocumentoGenerado,
                dg.ClaveDocumento,
                dg.ClaveExpediente,
                dg.Contenido,
                doc.Nombre AS NombreDocumento,

                a.ClaveActividad,
                a.Nombre AS NombreActividad,

                dep.ClaveDepartamento,
                dep.Nombre AS NombreDepartamento
            FROM DocumentoGenerado dg
            JOIN Documento doc 
                ON dg.ClaveDocumento = doc.ClaveDocumento

            OUTER APPLY (
                SELECT TOP 1 ad.ClaveActividad, ad.ClaveDepartamento
                FROM Actividad_Documento ad
                WHERE ad.ClaveDocumento = doc.ClaveDocumento
            ) ad

            LEFT JOIN Actividad a 
                ON ad.ClaveActividad = a.ClaveActividad

            LEFT JOIN Departamento dep
                ON ad.ClaveDepartamento = dep.ClaveDepartamento

            WHERE dg.ClaveExpediente = @ClaveExpediente
            ORDER BY doc.Nombre;
        `);

        this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE] Documentos encontrados: ${result.recordset.length}`);

        if (result.recordset.length === 0) {
        this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE] ⚠️ No hay documentos generados en este expediente`);
        return [];
        }

        // Procesar documentos y parsear contenido JSON
        const documentos = result.recordset.map((doc, index) => {
        let contenidoParsed: any;
        
        // Parsear contenido JSON si existe
        if (doc.Contenido) {
            try {
            contenidoParsed = JSON.parse(doc.Contenido);
            this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE] Documento ${index + 1}: ${doc.NombreDocumento}`);
            this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE]   - Clave: ${doc.ClaveDocumentoGenerado}`);
            this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE]   - Departamento: ${doc.NombreDepartamento || 'N/A'}`);
            this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE]   - Actividad: ${doc.NombreActividad || 'N/A'}`);
            this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE]   - Contenido JSON: Parseado exitosamente`);
            } catch (error) {
            this.logger.error(`[GET_DOCUMENTOS_EXPEDIENTE] ❌ Error parseando JSON del documento ${doc.ClaveDocumentoGenerado}`);
            this.logger.error(`[GET_DOCUMENTOS_EXPEDIENTE] Error: ${error.message}`);
            contenidoParsed = { error: 'Error al parsear contenido JSON' };
            }
        } else {
            this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE] Documento ${index + 1}: ${doc.NombreDocumento}`);
            this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE]   - Sin contenido JSON`);
        }

        return {
            claveDocumentoGenerado: doc.ClaveDocumentoGenerado,
            claveDocumento: doc.ClaveDocumento,
            claveExpediente: doc.ClaveExpediente,
            nombreDocumento: doc.NombreDocumento,
            contenido: contenidoParsed,
            contenidoRaw: doc.Contenido,
            actividad: doc.ClaveActividad ? {
            claveActividad: doc.ClaveActividad,
            nombre: doc.NombreActividad,
            } : null,
            departamento: doc.ClaveDepartamento ? {
            claveDepartamento: doc.ClaveDepartamento,
            nombre: doc.NombreDepartamento
            } : null
        };
        });

        this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE] ====== BÚSQUEDA COMPLETADA ======`);
        this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE] Total documentos procesados: ${documentos.length}`);
        
        // Estadísticas
        const conContenido = documentos.filter(d => d.contenido !== null).length;
        const sinContenido = documentos.length - conContenido;
        const conActividad = documentos.filter(d => d.actividad !== null).length;
        
        this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE] Estadísticas:`);
        this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE]   - Con contenido JSON: ${conContenido}`);
        this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE]   - Sin contenido JSON: ${sinContenido}`);
        this.logger.log(`[GET_DOCUMENTOS_EXPEDIENTE]   - Con actividad asociada: ${conActividad}`);

        return documentos;

    } catch (error) {
        this.logger.error(`[GET_DOCUMENTOS_EXPEDIENTE] ❌ ERROR al obtener documentos`);
        this.logger.error(`[GET_DOCUMENTOS_EXPEDIENTE] ClaveExpediente: ${claveExpediente}`);
        this.logger.error(`[GET_DOCUMENTOS_EXPEDIENTE] Error: ${error.message}`);
        this.logger.error(`[GET_DOCUMENTOS_EXPEDIENTE] Stack trace:`, error.stack);
        throw error;
    }
  }

  // ========== MÉTODOS AUXILIARES ==========
  /**
   * Obtener datos completos del docente
   * @param claveDocente string
   */
  async getProfessorDetails(claveDocente: string): Promise<FileInterfaces.Docente> {
    const result = await this.dynamicDb.executeQueryByDepartmentId(
      'DRRHH07',
      `SELECT 
          FechaIngreso AS fechaIngreso,
          FechaIngresoSEP AS fechaIngresoSEP,
          CONCAT(ClavePresupuestal, '-', Categoria) as clave,
          Estatus AS nombramiento
      FROM Docente 
      WHERE ClaveDocente = @ClaveDocente`,
      [{ name: 'ClaveDocente', value: claveDocente }]
    );

    const data: FileInterfaces.Docente = {
      clave: claveDocente,
      clavePresupuestal: result[0]?.clave || null,
      nombramiento: result[0]?.nombramiento || null,
      fechaIngreso: result[0]?.fechaIngreso || null,
      fechaIngresoSEP: result[0]?.fechaIngresoSEP || null,
    }

    return data;
  }

  /**
     * Verificar si un docente solo tiene asignaturas posgrado
     * @param claveDocente string
     * @param claveDepartamento string
     * @param año number
     * @param semestre string
     */
  async checkCourses(
    claveDocente: string,
    claveDepartamento: string,
    año: number,
    semestre: string
    ): Promise<boolean> {
    const pool = this.dynamicDb.executeQueryByDepartmentId(
        claveDepartamento,
        `SELECT ad.ClaveDocente
        FROM Asignatura_Docente ad
        INNER JOIN Asignatura a ON a.ClaveAsignatura = ad.ClaveAsignatura
        WHERE ad.ClaveDocente = @ClaveDocente
            AND a.Nivel = 'POSGRADO'
            AND ad.Año = @Año
            AND ad.Semestre = @Semestre
        GROUP BY ad.ClaveDocente
        HAVING COUNT(*) = (
            SELECT COUNT(*) 
            FROM Asignatura_Docente 
            WHERE ClaveDocente = @ClaveDocente
            AND Año = @Año
            AND Semestre = @Semestre
        )`,
        [
        { name: 'ClaveDocente', value: claveDocente },
        { name: 'Año', value: año },
        { name: 'Semestre', value: semestre }
        ]
    );
    return (await pool).length > 0;
  }

  /**
   * Insertar expediente en la base de datos
   * @param expediente Expediente
   */
  async insertExpediente(expediente: Expediente) {
    const pool = this.mssql.getPool();
    await pool
      .request()
      .input('ClaveExpediente', expediente.claveExpediente)
      .input('AñoGeneracion', expediente.añoGeneracion)
      .input('ClaveDocente', expediente.claveDocente)
      .query(`
        INSERT INTO Expediente (ClaveExpediente, AñoGeneracion, ClaveDocente)
        VALUES (@ClaveExpediente, @AñoGeneracion, @ClaveDocente)
      `);
  }

  /**
   * Insertar documentos generados a tabla correspondiente
   * @param documentos DocumentInterfaces.DocumentoGenerado[]
   * @claveExpediente string
   * @claveDocente string
   */
  async insertGeneratedDocuments(
    documentos: DocumentoConMetadatos[],
    claveExpediente: string,
    ) {
    const pool = this.mssql.getPool();
    
    for (let index = 0; index < documentos.length; index++) {
        const doc = documentos[index];
        
        try {
        await pool
            .request()
            .input('ClaveDocumentoGenerado', `${claveExpediente}-${doc.claveDocumento}-${index + 1}`)
            .input('ClaveExpediente', claveExpediente)
            .input('ClaveDocumento', doc.claveDocumento)
            .input('Contenido', JSON.stringify(doc))
            .query(`
            INSERT INTO DocumentoGenerado (
                ClaveDocumentoGenerado, 
                ClaveExpediente, 
                ClaveDocumento, 
                Contenido
            )
            VALUES (
                @ClaveDocumentoGenerado, 
                @ClaveExpediente, 
                @ClaveDocumento, 
                @Contenido
            )
            `);
            
        this.logger.log(`[INSERT_DOCS] Documento ${doc.claveDocumento} insertado correctamente`);
        
        } catch (error) {
        this.logger.error(`[INSERT_DOCS] Error insertando documento ${doc.claveDocumento}:`, error);
        throw error;
        }
    }
  }


  /**
   * Obtener todas las claves de documentos en actividades
   */
  async getAllDepartmentIds() {
    const pool = this.mssql.getPool();
    const result = await pool
      .request()
      .query(`SELECT DISTINCT ClaveDepartamento FROM Actividad_Documento`);

    return result.recordset.map(row => row.ClaveDepartamento);
  }

  /**
   * Eliminar expediente (y documentos generados) si ya existe
   * @param claveExpediente string
   */
  async deleteExpedienteIfExists(claveExpediente: string) {
    const pool = this.mssql.getPool();
    
    await pool
      .request()
      .input('ClaveExpediente', claveExpediente)
      .query(`
        DELETE FROM DocumentoGenerado
        WHERE ClaveExpediente = @ClaveExpediente
      `);
    
    await pool
      .request()
      .input('ClaveExpediente', claveExpediente)
      .query(`
        DELETE FROM Expediente
        WHERE ClaveExpediente = @ClaveExpediente
      `);
  }

  /**
   * Obtener documentos por clave de departamento
   * @param claveDepartamento: string
   */
  async getDocumentsByDepartment(claveDepartamento: string) {
    const pool = this.mssql.getPool();
    const result = await pool
      .request()
      .input('ClaveDepartamento', claveDepartamento)
      .query(`
        SELECT DISTINCT ClaveDocumento as claveDocumento
        FROM Actividad_Documento
        WHERE ClaveDepartamento = @ClaveDepartamento
            OR (ClaveDepartamento IS NULL 
                AND NOT EXISTS (
                    SELECT 1 
                    FROM Actividad_Documento 
                    WHERE ClaveDepartamento = @ClaveDepartamento
                )
            )
      `)

      return result.recordset.map(row => row.claveDocumento);
  }

  /**
   * Obtener clave de docente por clave de usuario
   * @param claveUsuario: string
   */
  async getProfessorId(claveUsuario: string) {
    const pool = this.mssql.getPool();
    const result = await pool 
      .request()
      .input('ClaveUsuario', claveUsuario)
      .query(`
        SELECT ClaveDocente AS claveDocente
        FROM Usuario
        WHERE ClaveUsuario = @ClaveUsuario
      `)

    return result.recordset[0]?.claveDocente || null;
  }

  /**
   * Obtener titular de departamento
   * @param claveDepartamento: string
   */
  async getDepartmentHeadById(claveDepartamento: string) {
    const pool = this.mssql.getPool();
    const result = await pool 
      .request()
      .input('ClaveDepartamento', claveDepartamento)
      .query(`
        SELECT
          CONCAT(TitularNombre, ' ', TitularApellidoPaterno, ' ', TitularApellidoMaterno) AS nombreCompleto
        FROM Departamento 
        WHERE ClaveDepartamento = @ClaveDepartamento
      `)

    return result.recordset[0]?.nombreCompleto || null;
  }

  /**
   * Obtener nombre de departamento por clave
   * @param claveDepartamento: string
   */
  async getDepartmentNameById(claveDepartamento: string) {
    const pool = this.mssql.getPool();
    const result = await pool
      .request()
      .input('ClaveDepartamento', claveDepartamento)
      .query(`
        SELECT Nombre AS nombre
        FROM Departamento
        WHERE ClaveDepartamento = @ClaveDepartamento
      `);

    return result.recordset[0]?.nombre || null;
  }

  /**
   * Obtener clave de departamento por nombre
   * @param nombreDepartamento string
   */
  async getDepartmentIdByName(nombreDepartamento: string) {
    const pool = this.mssql.getPool();
    
    // Normalizar el nombre para búsqueda
    const normalizedName = nombreDepartamento.trim().toLowerCase();
    
    const result = await pool
      .request()
      .input('NombreDepartamento', `%${normalizedName}%`)
      .query(`
        SELECT TOP 1 ClaveDepartamento AS claveDepartamento
        FROM Departamento
        WHERE LOWER(Nombre) LIKE @NombreDepartamento
        ORDER BY LEN(Nombre) ASC  -- Priorizar coincidencias más cortas (más exactas)
      `);
    
    return result.recordset[0]?.claveDepartamento || null;
  }

  /**
   * Obtener clave de departamento por clave de docente
   * @param claveDocente: string
   */
  async getDepartmentByProfessorId(claveDocente: string) {
    const pool = this.mssql.getPool();
    const result = await pool
      .request()
      .input('ClaveDocente', claveDocente)
      .query(`
        SELECT ClaveDepartamento AS claveDepartamento
        FROM Docente
        WHERE ClaveDocente = @ClaveDocente
      `);

    return result.recordset[0]?.claveDepartamento || null;
  }

  /**
     * Obtener clave de departamento por ID de documento
     * @param claveDocumento: string
     */
  async getDepartmentByDocumentId(claveDocumento: string) {
    const pool = this.mssql.getPool();

    const result = await pool
        .request()
        .input('ClaveDocumento', claveDocumento)
        .query(`
        SELECT TOP 1 ClaveDepartamento
        FROM SAPEDD.dbo.Actividad_Documento
        WHERE ClaveDocumento = @ClaveDocumento
            AND ClaveDepartamento IS NOT NULL
        `);

    return result.recordset[0]?.ClaveDepartamento || null;
  }

  /**
   * Obtener nombre de docente por clave
   * @param claveDocente: string
   */
  async getProfessorNameById(claveDocente: string) {
    const pool = this.mssql.getPool();
    const result = await pool 
      .request()
      .input('ClaveDocente', claveDocente)
      .query(`
        SELECT
          CONCAT(Nombre, ' ', ApellidoPaterno, ' ', ApellidoMaterno) AS nombreCompleto
        FROM Docente
        WHERE ClaveDocente = @ClaveDocente
      `)

    return result.recordset[0]?.nombreCompleto || null;
  }

  /**
   * Obtener nombre de documento por clave
   * @param claveDocumento: string
   */
  async getDocumentNameById(claveDocumento: string) {
    const pool = this.mssql.getPool();
    const result = await pool
      .request()
      .input('ClaveDocumento', claveDocumento)
      .query(`SELECT Nombre AS nombre 
              FROM Documento 
              WHERE ClaveDocumento = @ClaveDocumento`)
        
      return result.recordset[0]?.nombre || null;
    }

  /**
     * Obtener todos los documentos con filtros opcionales
     * @param tipo: string (opcional) - filtrar por tipo de documento
     */
  async getAllDocuments(tipo?: string) {
    const pool = this.mssql.getPool();
    const request = pool.request();
    
    let query = `
        SELECT 
        ClaveDocumento AS claveDocumento,
        Nombre AS nombre,
        Tipo AS tipo
        FROM Documento
    `;
    
    if (tipo) {
        query += ` WHERE Tipo = @Tipo`;
        request.input('Tipo', tipo);
    }
    
    query += ` ORDER BY ClaveDocumento`;
    
    const result = await request.query(query);
    return result.recordset || [];
  }

  // ========== MÉTODOS ESPECIFICOS POR DOCUMENTO ==========
  
  /**
   * DOC033, DOC034, DOC035, DOC036: Asesorías en concursos
   * @param base DocumentInterfaces.Base
   * @param claveDocente string
   * @param claveDepartamento string
   * @param año number
   * @param options tipoDocumento | proyectorPremiado
   */
  async generateAsesoriaConcursos(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number,
    options: {
      tipo: 'comision' | 'constancia',
      premiado: boolean
    }
  ): Promise<FileInterfaces.AsesoriaConcuros[]> {
    // Consulta dependerá de las opciones
    let query = (
      options.premiado 
      ? options.tipo === 'comision'
        ?  `SELECT 
              e.NombreEvento AS nombreEvento, 
              ae.FechaInicio AS fechaInicio, 
              ae.FechaFin AS fechaFin
            FROM AsesoriaEvento ae
            INNER JOIN Evento e ON e.ClaveEvento = ae.ClaveEvento
            LEFT JOIN Asesoria_ProyectoPremiado app ON app.ClaveAsesoria = ae.ClaveAsesoria
            WHERE ae.claveDocente = @ClaveDocente
              AND YEAR(ae.FechaInicio) = @Año` 
        :  `SELECT 
              e.NombreConcurso AS nombreConcurso, 
              ae.NombreProyecto AS nombreProyecto,
              app.LugarPremiado AS lugarPremiado
            FROM AsesoriaEvento ae
            INNER JOIN Evento e ON e.ClaveEvento = ae.ClaveEvento
            LEFT JOIN Asesoria_ProyectoPremiado app ON app.ClaveAsesoria = ae.ClaveAsesoria
            WHERE ae.ClaveDocente = @ClaveDocente
              AND YEAR(ae.FechaInicio) = @Año`
      : options.tipo === 'comision'
        ?  `SELECT 
              e.NombreEvento AS nombreEvento,
              ae.FechaInicio AS fechaInicio, 
              ae.FechaFin AS fechaFin
            FROM AsesoriaEvento ae
            INNER JOIN Evento e ON e.ClaveEvento = ae.ClaveEvento
            WHERE ae.ClaveDocente = @ClaveDocente
              AND YEAR(e.FechaInicio) = @Año` 
        :  `SELECT 
              e.NombreConcurso as nombreEvento, 
              e.Ubicacion as ubicacion, 
              ae.FechaInicio as fechaInicio, 
              ae.FechaFin as fechaFin
            FROM AsesoriaEvento ae
            INNER JOIN Evento e ON e.ClaveEvento = ae.ClaveEvento
            WHERE ae.ClaveDocente = @ClaveDocente
              AND YEAR(ae.FechaInicio) = @Año` 
    )

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente}, 
       {name: 'Año', value: año}]
    ) 

    let titular;
    if (options.tipo === 'constancia') 
      titular = await this.getDepartmentHeadById('DSUBD10'); 


    return result.map(row => ({
      ...base,
      evento: row?.nombreEvento ?? null,
      ubicacion: row?.ubicacion ?? null,
      nombreProyecto: row?.nombreProyecto ?? null,
      lugarPremiado: row?.lugarPremiado ?? null,
      fechaInicio: row?.fechaInicio ?? null,
      fechaFin: row?.fechaFin ?? null,
      subdireccion: titular || null
    }));
  }

  /**
   * DOC037, DOC038: Colaboración en eventos
   * @param base DocumentInterfaces.Base
   * @param claveDocente string
   * @param claveDepartamento string
   * @param año number
   */
  async generateColaboracionEventos(
    base: FileInterfaces.Base,
    claveDocente: string,  
    claveDepartamento: string,
    año: number,
    tipo: 'comision' | 'constancia'
  ): Promise<FileInterfaces.ColaboracionEventos[]> {
    let query = (
      tipo === 'comision'
      ?  `SELECT 
            e.NombreEvento AS nombreEvento,
            e.FechaInicio AS fechaInicio,
            e.FechaFin AS fechaFin
          FROM ColaboracionEvento ce
          INNER JOIN Evento e ON e.ClaveEvento = ce.ClaveEvento
          WHERE ce.ClaveDocente = @ClaveDocente
              AND YEAR(e.FechaInicio) = @Año`
      :   `SELECT 
            e.NombreConcurso AS nombreConcurso,
            ce.Funcion AS funcion,
            STRING_AGG(cea.NombreActividad, ', ') AS actividades,
            e.FechaInicio AS fechaInicio,
            e.FechaFin AS fechaFin
          FROM ColaboracionEvento ce
          INNER JOIN Evento e ON e.ClaveEvento = ce.ClaveEvento
          INNER JOIN ColaboracionEvento_Actividad cea ON cea.ClaveEvento = ce.ClaveEvento
          WHERE ce.ClaveDocente = @ClaveDocente 
            AND (ce.Funcion LIKE '%coordinador%' OR ce.Funcion LIKE '%colaborador%')
            AND YEAR(e.FechaInicio) = @Año
          GROUP BY 
            e.NombreConcurso, 
            ce.Funcion,
            e.FechaInicio,
            e.FechaFin`
    )

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    let titular;
    if (tipo === 'constancia')
      titular = await this.getDepartmentHeadById('DSUBD10');

    return result.map(row => ({
      ...base,
      evento: row?.nombreEvento ?? null,
      funcion: row?.funcion ?? null,
      actividades: row?.actividades ?? null,
      fechaInicio: row?.fechaInicio ?? null,
      fechaFin: row?.fechaFin ?? null,
      subdireccion: titular || null
    }));
  }

  /**
   * DOC039, DOC040: Participación como jurado en eventos
   * @param base DocumentInterfaces.Base
   * @param claveDocente string
   * @param claveDepartamento string
   * @param año number
   */
  async generateJuradoEventos(
    base: FileInterfaces.Base,
    claveDocente: string, 
    claveDepartamento: string,
    año: number,
    tipo: 'comision' | 'constancia'
  ): Promise<FileInterfaces.JuradoEventos[]> {
    let query = (
      tipo === 'comision'
      ?  `SELECT 
            e.NombreEvento AS nombreEvento,
            e.FechaInicio AS fechaInicio,
            e.Ubicacion AS lugar
          FROM ParticipacionConcurso_Jurado pcj
          INNER JOIN Evento e ON e.ClaveEvento = pcj.ClaveEvento
          WHERE pcj.ClaveDocente = @ClaveDocente
              AND YEAR(e.FechaInicio) = @Año`
      :  `SELECT 
            e.NombreEvento AS nombreEvento,
            pcj.Categoria AS categoria
          FROM ParticipacionConcurso_Jurado pcj
          INNER JOIN Evento e ON e.ClaveEvento = pcj.ClaveEvento
          WHERE pcj.ClaveDocente = @ClaveDocente
              AND YEAR(e.FechaInicio) = @Año`
    )

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )
    
    let titular;
    if (tipo === 'constancia')
      titular = await this.getDepartmentHeadById('DSUBD10');

    return result.map(row => ({
      ...base,
      evento: row?.nombreEvento ?? null,
      fechaInicio: row?.fechaInicio ?? null,
      ubicación: row?.lugar ?? null,
      categoria: row?.categoria ?? null,
      subdireccion: titular || null
    }));
  }

  /**
   * DOC041, DOC042: Participación en comités de evaluación
   * @param base DocumentInterfaces.Base
   * @param claveDocente string
   * @param claveDepartamento string
   * @param año number
   */
  async generateComitesEvaluacion(
    base: FileInterfaces.Base,
    claveDocente: string, 
    claveDepartamento: string,
    año: number,
    tipo: 'comision' | 'constancia'
  ): Promise<FileInterfaces.ComitesEvaluacion[]> {
    let query = (
      tipo === 'comision'
      ?  `SELECT
            CASE 
              WHEN ce.Tipo LIKE '%evaluación%'
              THEN 'EVALUACIÓN'
              ELSE 'ACREDITACIÓN'
            END AS comite,
            ce.Tipo AS tipo,
            ce.Organismo AS organismo
          FROM ComiteEvaluador ce
          WHERE ce.ClaveDocente = @ClaveDocente
            AND Año = @Año`
      :  `SELECT 
            ce.Tipo AS tipo,
            ce.Organismo AS organismo
          FROM ComiteEvaluador ce
          WHERE ce.ClaveDocente = @ClaveDocente
            AND Año = @Año`
    )

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    let titular;
    if (tipo === 'constancia')
      titular = await this.getDepartmentHeadById('DSUBD10');

    return result.map(row => ({
      ...base,
      comite: row.comite,
      tipo: row.tipo,
      organismo: row.organismo,
      subdireccion: titular || null,
    }));
  }

  /**
   * DOC043, DOC044: Auditorías
   * @param base DocumentInterfaces.Base
   * @param claveDocente string
   * @param claveDepartamento string
   * @param año number
   */
  async generateAuditorias(
    base: FileInterfaces.Base,
    claveDocente: string, 
    claveDepartamento: string,
    año: number,
    tipo: 'comision' | 'constancia'
  ): Promise<FileInterfaces.Auditorias[]> {
    let query = (
      tipo === 'comision'
      ?  `SELECT a.TipoSistema AS tipoSistema
          FROM Auditoria a
          where a.ClaveDocente = @ClaveDocente
              and YEAR(a.FechaInicio) = @Año`
      :  `SELECT 
            a.FuncionDocente AS funcionDocente,
            a.TipoSistema AS tipoSistema,
            a.FechaInicio AS fechaInicio,
            a.FechaFin AS fechaFin,
            a.Lugar AS lugar
          FROM Auditoria a
          WHERE a.ClaveDocente = @ClaveDocente
            AND YEAR(a.FechaInicio) = @Año`
    )

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    let titular;
    if (tipo === 'constancia')
      titular = await this.getDepartmentHeadById('DSUBD10');

    return result.map(row => ({
      ...base,
      tipoSistema: row?.tipoSistema ?? null,
      funcion: row?.funcionDocente ?? null,
      fechaInicio: row?.fechaInicio ?? null,
      fechaFin: row?.fechaFin ?? null,
      lugar: row?.lugar ?? null,
      subdireccion: titular || null
    }));
  }

  /**
   * DOC045, DOC046, DOC047: Elaboración de planes y programas
   * @param base DocumentInterfaces.Base
   * @param claveDocente string
   * @param claveDepartamento string
   * @param año number
   */
  async generateElaboracionPlanes(
    base: FileInterfaces.Base,
    claveDocente: string, 
    claveDepartamento: string,
    año: number,
    options: {
      tipo: 'comision' | 'constancia'
      nivel: 'local' | 'nacional' | 'null'
    }
  ): Promise<FileInterfaces.DesarrolloCurricular[]> {
    let query = (
      options.tipo === 'comision'
      ?  `SELECT 
            ep.FechaInicio AS fechaInicio,
            ep.FechaFin AS fechaFin
          FROM ElaboracionPlan ep
          WHERE ep.ClaveDocente = @ClaveDocente
            AND YEAR(ep.FechaInicio) = @Año`
      :  `SELECT 
            p.NombrePrograma AS nombrePrograma,
            ep.FechaInicio AS fechaInicio,
            ep.FechaFin AS fechaFin
          FROM ElaboracionPlan ep
          INNER JOIN Programa p ON p.ClavePrograma = ep.ClavePrograma
          WHERE ep.ClaveDocente = @ClaveDocente
            AND ep.Nivel = @Nivel
            AND YEAR(ep.FechaInicio) = @Año`
    )

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año},
       {name: 'Nivel', value: options.nivel}]
    )

    return result.map(row => ({
      ...base,
      programa: row?.nombrePrograma ?? null,
      fechaInicio: row.fechaInicio,
      fechaFin: row.fechaFin
    }));
  }
  
  /**
   * DOC048, DOC049, DOC050: Elaboración de módulos de especialidad
   * @param base DocumentInterfaces.Base
   * @param claveDocente string
   * @param claveDepartamento string
   * @param año number
   */
  async generateElaboracionModulos(
    base: FileInterfaces.Base,
    claveDocente: string, 
    claveDepartamento: string,
    año: number,
    tipo : 'comision' | 'constancia' | 'registro'
  ): Promise<FileInterfaces.DesarrolloCurricular[]> {
    let query =(
      tipo === 'comision'
      ?  `SELECT 
            p.NombrePrograma AS nombrePrograma,
            eme.FechaInicio AS fechaInicio,
            eme.FechaFin AS fechaFin
          FROM ElaboracionModuloEspecialidad eme
          INNER JOIN Programa p ON p.ClavePrograma = eme.ClavePrograma
          WHERE eme.ClaveDocente = @ClaveDocente
            AND eme.Nivel = 'licenciatura'
            AND YEAR(eme.FechaInicio) = @Año`
      :  `SELECT 
            STRING_AGG(lm.NombreModulo, ', ') AS modulos,
            p.NombrePrograma AS nombrePrograma
          FROM ElaboracionModuloEspecialidad eme
          INNER JOIN ListaModulo lm ON eme.ClaveRegistro = lm.ClaveRegistro
          INNER JOIN Programa p ON p.ClavePrograma = eme.ClavePrograma
          WHERE eme.ClaveDocente = @ClaveDocente
            AND eme.Nivel = 'licenciatura'
            AND YEAR(eme.FechaInicio) = @Año
          GROUP BY 
            p.NombrePrograma, 
            eme.ClaveDocente`
    )

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    let titular;
    if (tipo === 'constancia')
      titular = await this.getDepartmentHeadById('DSUBD10');

    return result.map(row => ({
      ...base,
      programa: row.nombrePrograma,
      fechaInicio: row.fechaInicio,
      fechaFin: row.fechaFin,
      modulos: row?.modulos ?? null,
      subdireccion: titular || null
    }));
  }

  /**
   * DOC051, DOC052, DOC053: Apertura de programas
   * @param base DocumentInterfaces.Base
   * @param claveDocente string
   * @param claveDepartamento string
   * @param año number
   */
  async generateAperturaProgramas(
    base: FileInterfaces.Base, 
    claveDocente: string, 
    claveDepartamento: string,
    año: number,
    tipo: 'comision' | 'constancia' | 'autorizacion'
  ): Promise<FileInterfaces.DesarrolloCurricular[]> {
    let query = (
      tipo === 'comision'
      ?  `SELECT 
            ap.NombrePrograma AS nombrePrograma,
            ap.Nivel AS nivel,
            ap.FechaInicio AS fechaInicio,
            ap.FechaFin AS fechaFin
          FROM AperturaPrograma ap
          INNER JOIN Direccion.dbo.ListaDocentes ld ON ap.ClavePrograma = ld.ClavePrograma
          WHERE ld.ClaveDocente = @ClaveDocente
              AND YEAR(ap.FechaInicio) = @Año`
      : tipo === 'constancia'
        ?  `SELECT 
              ap.NombrePrograma AS nombrePrograma,
              ap.Nivel AS nivel,
              STRING_AGG(CONCAT(d.Nombre, ' ', d.ApellidoPaterno, ' ', d.ApellidoMaterno), ', ') AS docentes
            FROM AperturaPrograma ap
            INNER JOIN ListaDocentes ld ON ld.ClavePrograma = ap.ClavePrograma
            INNER JOIN Docente d ON d.ClaveDocente = ld.ClaveDocente
            WHERE ap.ClavePrograma IN (
              SELECT ClavePrograma 
              FROM ListaDocentes 
              WHERE ClaveDocente = @ClaveDocente
            ) AND YEAR(ap.FechaInicio) = @Año
            GROUP BY 
              ap.NombrePrograma,
              ap.Nivel,
              ap.FechaInicio` 
        :  `SELECT 
              ap.NombrePrograma AS nombrePrograma,
              ap.Nivel AS nivel,
              ap.ClavePrograma AS clavePrograma,
              pa.Modalidad AS modalidad
            FROM ProgramaAprobado pa
            INNER JOIN AperturaPrograma ap ON ap.ClavePrograma = pa.ClavePrograma
            INNER JOIN ListaDocentes ld ON ld.ClavePrograma = ap.ClavePrograma
            WHERE ld.ClaveDocente = @ClaveDocente
                AND YEAR(pa.Fecha) = @Año`
    )

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    let titular;
    if (tipo === 'constancia')
      titular = await this.getDepartmentHeadById('DSUBD10');

    return result.map(row => ({
      ...base,
      programa: row.nombrePrograma,
      nivel: row.nivel,
      fechaInicio: row?.fechaInicio ?? null,
      fechaFin: row?.fechaFin ?? null,
      listaDocentes: row?.docentes ?? null,
      clavePrograma: row?.clavePrograma ?? null,
      modalidad: row?.modalidad ?? null,
      subdireccion: titular || null
    }));
  }

  /**
   * DOC054, DOC055: Prestación de servicios docentes
   * @param claveDocente: string
   * @param claveDepartamento: string
   */
  async generatePrestacionServicios(
    base: FileInterfaces.Base,
    claveDocente: string, 
    claveDepartamento: string
  ): Promise<FileInterfaces.PrestacionServicios[]> {
    let query = `
      SELECT 
        d.RFC AS rfc,
        d.FechaIngreso AS fechaIngreso,
        d.ClavePresupuestal AS clavePresupuestal,
        d.Estatus AS estatus,
        d.CargaHoraria AS cargaHoraria,
        d.Categoria AS categoria,
        d.Plaza AS plaza
      FROM Docente d
      WHERE d.ClaveDocente = @ClaveDocente
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente}]
    )

    return result.map(row => ({
      ...base,
      rfc: row.rfc,
      fechaIngreso: row.fechaIngreso,
      clavePresupuestal: row.clavePresupuestal,
      estatus: row.estatus,
      cargaHoraria: row.cargaHoraria,
      categoria: row.categoria,
      plaza: row.plaza
    }));
  }

  /**
   * DOC056: Constancia de proyecto de investigación vigente
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateProyectoInvestigacion(
    base: FileInterfaces.Base,
    claveDocente: string, 
    claveDepartamento: string,
    año: number
  ): Promise<FileInterfaces.ProyectoInvestigacion[]> {
    const query = `
      SELECT 
        pi.NombreProyecto AS nombreProyecto,
        pi.Descripcion AS descripcion
      FROM ProyectoInvestigacion pi 
      WHERE pi.ClaveDocente = @ClaveDocente
          AND Año = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    const direccion = await this.getDepartmentHeadById('DDIRE02');

    return result.map(row => ({
      ...base,
      nombreProyecto: row.nombreProyecto,
      descripcion: row.descripcion,
      direccion: direccion || null
    }));
  }
  
  /**
   * DOC057: Curriculum vitae de actualizado
   * @param claveDocente: string
   * @param claveDepartamento: string
   */
  async generateCurriculumVitae(
    base: FileInterfaces.Base,
    claveDocente: string, 
    claveDepartamento: string
  ): Promise<FileInterfaces.CurriculumVitae[]> {
    const query = `
      SELECT
        d.CVUEstado AS estado
      FROM Docente d
      WHERE d.ClaveDocente = @ClaveDocente
          AND d.CVUEstado = 'VIGENTE'
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente}]
    )

    return result.map(row => ({
      ...base,
      estado: row.estado
    }));
  }

  /**
   * DOC058: Autorización de licencias especiales
   * @param claveDocente: string
   * @param claveDepartamento: string
   */
  async generateLicenciasEspeciales(
    base: FileInterfaces.Base,
    claveDocente: string, 
    claveDepartamento: string,
    año: number
  ): Promise<FileInterfaces.LicenciasEspeciales[]> {
    const query = `
      SELECT 
        le.TipoLicencia AS tipoLicencia,
        le.FechaInicio AS fechaInicio,
        le.FechaFin AS fechaFin,
        le.ClaveOficioAutorizacion AS claveOficioAutorizacion
      FROM LicenciaEspecial le
      WHERE le.ClaveDocente = @ClaveDocente
        AND YEAR(le.FechaInicio) = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return result.map(row => ({
      ...base,
      tipoLicencia: row.tipoLicencia,
      fechaInicio: row.fechaInicio,
      fechaFin: row.fechaFin,
      claveOficioAutorizacion: row.claveOficioAutorizacion
    }));
  }

  /**
   * DOC059, DOC060: Cumplimiento de actividades
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateCumplimientoActividades(
    base: FileInterfaces.Base,
    claveDocente: string, 
    claveDepartamento: string,
    año: number,
    tipo : 'semestre' | 'anual'
  ): Promise<FileInterfaces.CumplimientoActividades[]> {
    let query = (
      tipo === 'semestre'
      ?  `SELECT 
            Año as año,
            Semestre as semestre,
            CASE 
              WHEN COUNT(*) = SUM(Estado)
                THEN 'LIBERADO'
                ELSE 'NO LIBERADO'
            END AS estado
          FROM Asignatura_Docente
          WHERE ClaveDocente = @ClaveDocente
            AND Año = @Año
          GROUP BY 
            Año,
            Semestre`
      :  `SELECT 
            Año as año,
            CASE 
              WHEN COUNT(*) = SUM(Estado)
                THEN 'LIBERADO'
                ELSE 'NO LIBERADO'
            END AS estado
          FROM Asignatura_Docente
          WHERE ClaveDocente = @ClaveDocente
            AND Año = @Año
          GROUP BY Año`
    )

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return result.map(row => ({
      ...base,
      año: row.año,
      semestre: row?.semestre ?? null,
      estado: row.estado
    }));
  }

  /**
   * DOC061, DOC062, DOC063: Evaluaciones
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param claveDepartamento: string
   * @param año: number
   */
  async generateEvaluaciones(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number,
    tipo: 'departamental' | 'desempeño'
  ): Promise<FileInterfaces.Evaluaciones[]> {    
    let query = (
      tipo === 'departamental'
      ?  `SELECT 
            Año AS año,
            Semestre AS semestre,
            Calificacion AS calificacion
          FROM EvaluacionDepartamental
          WHERE ClaveDocente = @ClaveDocente
            AND Año = @Año`
      :  `SELECT 
            Año AS año,
            Semestre AS semestre,
            Calificacion AS calificacion,
            PorcentajeEstudiantado AS porcentajeEstudiantado
          FROM EvaluacionDesempeño
          WHERE ClaveDocente = @ClaveDocente
            AND Año = @Año`
    );

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
      {name: 'Año', value: año}]
    );

    const subdireccion = await this.getDepartmentHeadById('DSUBD10');

    return result.map(row => ({
      ...base,
      año: row.año,
      semestre: row.semestre,
      subdireccion: subdireccion || null,
      calificacion: row?.calificacion ?? null,
      porcentajeEstudiantado: row?.porcentajeEstudiantado ?? null
    }));
  }

  /**
   * DOC001, DOC003, DOC005: Horarios de asignaturas
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param claveDepartamento: string
   * @param año: number
   */
  async generateHorariosAsignaturas(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number
  ): Promise<FileInterfaces.Horarios[]> {
    const query = `
      SELECT 
        a.Nombre AS asignatura,
        a.ClaveAsignatura AS claveAsignatura,
        ad.ClaveGrupo AS claveGrupo,
        g.TotalAlumnos AS totalAlumnos,
        ad.Aula AS aula,
        a.Nivel AS nivel,
        g.Modalidad AS modalidad,
        g.Horario AS horario,
        CASE
            WHEN g.Horario LIKE '%LUN-VIE%' THEN 5
            WHEN g.Horario LIKE '%LUN-JUE%' THEN 4
            WHEN g.Horario LIKE '%LUN-MIER%' THEN 3
        END AS horasSemana
      FROM Asignatura_Docente ad
      INNER JOIN Grupo g 
        ON ad.ClaveGrupo = g.ClaveGrupo
        AND ad.Año = g.Año 
        AND ad.Semestre = g.Semestre
      INNER JOIN Asignatura a ON ad.ClaveAsignatura = a.ClaveAsignatura
      WHERE ad.ClaveDocente = @ClaveDocente
      AND ad.Año = @Año
      AND ad.Semestre = @Semestre
    `;

    const periodos = [
      {año: año, semestre: 'ENERO-JUNIO'},
      {año: año, semestre: 'AGOSTO-DICIEMBRE'},
      {año: año + 1, semestre: 'ENERO-JUNIO'}
    ];

    const results: FileInterfaces.Horarios[] = [];

    for (const periodo of periodos) {
      let asignaturas: FileInterfaces.AsignaturaDetalle[] = [];
      let totalHoras = 0;

      const r = await this.dynamicDb.executeQueryByDepartmentId(
        claveDepartamento,
        query,
        [{ name: 'ClaveDocente', value: claveDocente },
         { name: 'Año', value: periodo.año },
         { name: 'Semestre', value: periodo.semestre }]
      );

      r.forEach(row => {
        asignaturas.push({
          nombre: row.asignatura,
          clave: row.claveAsignatura,
          grupo: row.claveGrupo,
          estudiantes: row.totalAlumnos,
          aula: row.aula,
          nivel: row.nivel,
          modalidad: row.modalidad,
          horario: row.horario,
          horas: row.horasSemana
        })
        totalHoras += row.horasSemana;
      });

      results.push({
        ...base,
        periodo: `${periodo.semestre} ${periodo.año}`,
        asignaturas,
        totalHoras
      })
    }

    return results;
  }

  /**
   * DOC002, DOC004, DOCOO6: Constancias de asignaturas
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param claveDepartamento: string
   * @param año: number
   */
  async generateConstanciaAsignaturas(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number,
  ): Promise<FileInterfaces.ConstanciaAsignaturas[]> {    
    const query = `
      SELECT 
          ea.ClaveExpediente AS expediente,
          CONCAT(ea.Semestre, ' ', ea.Año) AS periodo,
          a.Nivel AS nivel,
          a.ClaveAsignatura AS claveAsignatura,
          a.Nombre AS asignatura,
          g.TotalAlumnos AS totalAlumnos
      FROM ExpedienteAsignatura ea
      INNER JOIN Asignatura a ON ea.ClaveAsignatura = a.ClaveAsignatura
      INNER JOIN Grupo g 
          ON ea.ClaveGrupo = g.ClaveGrupo
          AND ea.Año = g.Año 
          AND ea.Semestre = g.Semestre
      WHERE ea.ClaveDocente = @ClaveDocente
          AND ea.Año = @Año
      ORDER BY ea.Semestre DESC
    `;

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{ name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }]
    );

    let asignaturas: FileInterfaces.AsignaturaDetalle[] = [];
    let totalAlumnos = 0;

    result.forEach(row => {
      asignaturas.push({
        periodo: row.periodo,
        nivel: row.nivel,
        clave: row.claveAsignatura,
        nombre: row.asignatura,
        estudiantes: row.totalAlumnos
      });

      totalAlumnos += row.totalAlumnos;
    });

    return [{
      ...base,
      año: año,
      asignaturas,
      totalAlumnos
    }];
  }

  /**
   * DOC008: Constancia de tutorías PIT
   */
  async generateTutorias(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number,
  ): Promise<FileInterfaces.Tutorias[]> {
    const query = `
      SELECT 
        CONCAT(t.Semestre, ' ', t.Año) AS periodo,
        SUM(g.TotalAlumnos) AS tutorados,
        g.Carrera AS carrera
      FROM Tutoria t
      INNER JOIN Grupo g ON t.ClaveGrupo = g.ClaveGrupo
      WHERE t.ClaveDocente = @ClaveDocente
        AND t.Año = @Año
      GROUP BY t.Semestre, t.Año, g.Carrera
      ORDER BY t.Semestre DESC
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{ name: 'ClaveDocente', value: claveDocente },
       { name: 'Año', value: año }]
    );

    let tutorias: FileInterfaces.TutoriasDetalle[] = [];
    let total = 0;

    result.forEach(row => {
      tutorias.push({
        periodo: row.periodo,
        carrera: row.carrera,
        tutorados: row.tutorados
      });
      total += row.tutorados;
    });

    const subdireccion = await this.getDepartmentHeadById('DSUBD10');

    return [{
      ...base,
      tutorias: tutorias,
      totalTutorados: total,
      subdireccion: subdireccion || null
    }]
  }

  /**
   * DOC009: Constancia de acreditación de programas
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param claveDepartamento: string
   */
  async generateAcreditacionProgramas(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string
  ): Promise<FileInterfaces.AcreditacionPrograma[]> {
    const query = `
      SELECT 
          SNP AS snp,
          FechaAcreditacion AS fechaAcreditacion,
          FechaVigencia AS fechaVigencia,
          OrganoAcreditador AS organoAcreditador,
          ProgramaEducativo AS programaEducativo
      FROM AcreditacionPrograma
      WHERE ClaveDocente = @ClaveDocente
          AND FechaVigencia >= GETDATE()
    `;

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{ name: 'ClaveDocente', value: claveDocente }]
    );

    const subdireccion = await this.getDepartmentHeadById('DSUBD10');

    return result.map(row => ({
      ...base,
      snp: row.snp,
      fechaAcreditacion: row.fechaAcreditacion,
      fechaVencimiento: row.fechaVigencia,
      organismoAcreditador: row.organoAcreditador,
      nombrePrograma: row.programaEducativo,
      subdireccion: subdireccion || null
    }));
  }

  /**
   * DOC010: Constancia de actividades complementarias
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param claveDepartamento: string
   * @param año: number
   */
  async generateActividadesComplementarias(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number
  ): Promise<FileInterfaces.ActividadesComplementarias[]> {
    const query = `
      SELECT
          dc.NumeroDictamen AS dictamen,
          ac.Nombre AS nombre,
          dc.Creditos AS creditos,
          g.TotalAlumnos AS totalAlumnos
      FROM ActividadComplementaria ac
      INNER JOIN Docente_Complementaria dc ON ac.ClaveActividadComplementaria = dc.ClaveActividadComplementaria
      INNER JOIN Grupo g 
          ON dc.ClaveGrupo = g.ClaveGrupo
          AND dc.Año = g.Año
          AND dc.Semestre = g.Semestre
      WHERE dc.ClaveDocente = @ClaveDocente
        AND dc.Año = @Año
    `;

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{ name: 'ClaveDocente', value: claveDocente },
       { name: 'Año', value: año }]
    );

    const subdireccion = await this.getDepartmentHeadById('DSUBD10');

    return result.map(row => ({
      ...base,
      nombreActividad: row.nombre,
      dictamen: row.dictamen,
      creditos: row.creditos,
      estudiantes: row.totalAlumnos,
      subdireccion: subdireccion || null
    }));
  }

  /**
   * DOC011: Constancia proyecto integrador
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param claveDepartamento: string
   * @param año: number
   */
  async generateProyectoIntegrador(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number
  ): Promise<FileInterfaces.ProyectoIntegrador[]> {
    const query = `
      SELECT 
          pi.Nombre AS nombreProyecto,
          STRING_AGG(a.Nombre, ', ') AS asignaturas
      FROM ProyectoIntegrador pi
      INNER JOIN ProyectoIntegrador_Asignatura pia ON pia.ClaveProyecto = pi.ClaveProyecto
      INNER JOIN Asignatura a ON a.ClaveAsignatura = pia.ClaveAsignatura
      WHERE pi.ClaveDocente = @ClaveDocente
          AND pi.Año = @Año
      GROUP BY pi.Nombre
    `;

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{ name: 'ClaveDocente', value: claveDocente },
       { name: 'Año', value: año }]
    );

    const subdireccion = await this.getDepartmentHeadById('DSUBD10');

    return result.map(row => ({
      ...base,
      nombreProyecto: row.nombreProyecto,
      asignaturas: row.asignaturas
    }));
  }

  /**
   * DOC012, DOC013, DOC014: Manuales y materiales didácticos
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param claveDepartamento: string
   * @param año: number
   */
  async generateConstanciasElaboracionMaterial(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number,
    tipo: 'manual' | 'estrategias' | 'materiales'
  ): Promise<FileInterfaces.ElaboracionMaterial[]> {
    let query = (
      tipo === 'manual'
      ? `SELECT DISTINCT 
            Nombre AS nombre
        FROM ManualPractica
        WHERE ClaveDocente = @ClaveDocente
            AND Año = @Año
            AND Estado = 1`

      : tipo === 'estrategias'
          ? `SELECT 
                a.Nombre AS asignatura,
                ie.DescripcionImpacto AS descripcionImpacto,
                STRING_AGG(pe.NombreProducto, ', ') AS productos
            FROM ImplementacionEstrategia ie
            INNER JOIN Asignatura a ON ie.ClaveAsignatura = a.ClaveAsignatura
            INNER JOIN Producto_Estrategia pe 
                ON ie.Año = pe.Año
                AND ie.Semestre = pe.Semestre
                AND ie.ClaveDocente = pe.ClaveDocente
                AND ie.ClaveAsignatura = pe.ClaveAsignatura
            WHERE ie.ClaveDocente = @ClaveDocente
                AND ie.Año = @Año
            GROUP BY a.Nombre, ie.DescripcionImpacto`

          : `SELECT DISTINCT
                md.Enfoque AS enfoque,
                md.DescripcionImpacto AS descripcionImpacto,
                STRING_AGG(pm.NombreProducto, ', ') AS productos
            FROM MaterialDidactico md
            INNER JOIN Producto_MaterialDidactico pm 
                ON md.Año = pm.Año
                AND md.Semestre = pm.Semestre
                AND md.ClaveMaterial = pm.ClaveMaterial
            WHERE md.ClaveDocente = @ClaveDocente
                AND md.Año = @Año
            GROUP BY md.Enfoque, md.DescripcionImpacto`
    );

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{ name: 'ClaveDocente', value: claveDocente },
       { name: 'Año', value: año }]
    );

    const subdireccion = await this.getDepartmentHeadById('DSUBD10');

    return result.map(row => ({
      ...base,
      nombre: row?.nombre || null,
      asignatura: row?.asignatura || null,
      descripcionImpacto: row?.descripcionImpacto || null,
      productos: row?.productos || null,
      enfoque: row?.enfoque || null,
      subdireccion: subdireccion || null
    }));
  }

  /**
   * DOC015, DOC016, DOC017, DOC018: Cursos de formación docente
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param claveDepartamento: string
   * @param año: number
   */
  async generateCursosImpartidos(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number,
    options: {
      tipo: 'comision' | 'constancia'
      origen: string
    }
  ): Promise<FileInterfaces.CursosImpartidos[]> {
    let query = (
      options.tipo === 'comision'
      ? `SELECT 
            NombreCurso AS nombreCurso,
            Tipo AS tipoCurso,
            HorasDuracion AS duracion
        FROM Curso
        WHERE ClaveDocente = @ClaveDocente
            AND YEAR(FechaInicio) = @Año
            AND OrigenCurso = @Origen`

      : `SELECT 
            NombreCurso AS nombreCurso,
            NumeroRegistro AS numeroRegistro,
            FechaInicio AS fechaInicio,
            FechaFin AS fechaFin,
            HorasDuracion AS duracion,
            TotalDocentes AS docentesBeneficiados
        FROM Curso
        WHERE ClaveDocente = @ClaveDocente
            AND YEAR(FechaInicio) = @Año
            AND OrigenCurso = @Origen`
    )

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{ name: 'ClaveDocente', value: claveDocente },
       { name: 'Año', value: año },
       { name: 'Origen', value: options.origen }]
    );

    return result.map(row => ({
      ...base,
      nombreCurso: row.nombreCurso,
      tipoCurso: row.tipoCurso || null,
      duracion: row.duracion,
      fechaInicio: row?.fechaInicio || null,
      fechaFin: row?.fechaFin || null,
      numeroRegistro: row?.numeroRegistro || null,
      docentesBeneficiados: row?.docentesBeneficiados || null
    }));
  }

  /**
   * DOC019, DOC020, DOC021, DOC022, DOC023, DOC024, DOC025: Diplomados
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param claveDepartamento: string
   * @param año: number
   */
  async generateDiplomados(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number,
    tipo: 'comision' | 'constancia'
  ): Promise<FileInterfaces.Diplomados[]> {
    let query = (
      tipo === 'comision'
      ? `SELECT 
            d.NombreDiplomado AS nombreDiplomado
        FROM InstructorDiplomado id 
        INNER JOIN Diplomado d 
            ON id.ClaveDiplomado = d.ClaveDiplomado
        WHERE id.ClaveDocente = @ClaveDocente
            AND YEAR(id.FechaInicio) = @Año
            AND d.ClaveDiplomado NOT IN (
              SELECT ClaveDiplomado
              FROM Diplomado_ProyectoEstrategico
            )`
      : `SELECT 
            NombreModulo AS NombreModulo,
            HorasDuracion AS horasDuracion
        FROM InstructorDiplomado
        WHERE ClaveDocente = @ClaveDocente
            AND YEAR(FechaInicio) = @Año
            AND ClaveDiplomado NOT IN (
              SELECT ClaveDiplomado
              FROM Diplomado_ProyectoEstrategico
            )`
    );

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{ name: 'ClaveDocente', value: claveDocente },
       { name: 'Año', value: año }]
    );

    return result.map(row => ({
      ...base,
      nombreDiplomado: row?.nombreDiplomado || null,
      nombreModulo: row?.NombreModulo || null,
      horasDuracion: row?.horasDuracion || null
    }));
  }

  /**
   * DOC026, DOC027: Diplomados estratégicos
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param claveDepartamento: string
   * @param año: number
   */
  async generateDiplomadosEstrategicos(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number,
    tipo: 'comision' | 'constancia'
  ): Promise<FileInterfaces.DiplomadosEstrategicos[]> {
    let query = (
      tipo === 'comision'
      ? `SELECT 
            d.NombreDiplomado AS nombreDiplomado,
            dpe.NombreProyecto AS nombreProyecto
        FROM Diplomado_ProyectoEstrategico dpe 
        INNER JOIN Diplomado d ON dpe.ClaveDiplomado = d.ClaveDiplomado
        INNER JOIN InstructorDiplomado id ON dpe.ClaveDiplomado = id.ClaveDiplomado
        WHERE id.ClaveDocente = @ClaveDocente
            AND YEAR(id.FechaInicio) = @Año`
            
      : `SELECT 
            d.NombreDiplomado AS nombreDiplomado,
            dpe.NombreProyecto AS nombreProyecto,
            id.HorasDuracion AS horasDuracion
        FROM Diplomado_ProyectoEstrategico dpe 
        INNER JOIN Diplomado d ON dpe.ClaveDiplomado = d.ClaveDiplomado
        INNER JOIN InstructorDiplomado id ON dpe.ClaveDiplomado = id.ClaveDiplomado
        WHERE id.ClaveDocente = @ClaveDocente
            AND YEAR(id.FechaInicio) = @Año`
    );


    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{ name: 'ClaveDocente', value: claveDocente },
        { name: 'Año', value: año }]
    );

    return result.map(row => ({
      ...base,
      nombreDiplomado: row.nombreDiplomado,
      nombreProyectoEstrategico: row.nombreProyecto,
      duracionHoras: row?.horasDuracion || null
    }));
  }

  /**
   * DOC028, DOC030: Titulaciones
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param claveDepartamento: string
   * @param año: number
   */
  async generateTitulaciones(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number,
    tipo: 'acta' | 'constancia'
  ): Promise<FileInterfaces.Titulacion[]> {
    let query = (
      tipo === 'acta'
      ? `SELECT 
            CONCAT(e.Nombre, ' ', e.ApellidoPaterno, ' ', e.ApellidoMaterno) AS nombreAlumno,
            et.NumeroControl AS numeroControl,
            et.Fecha AS fechaExamen,
            et.ProgramaEducativo AS programaEducativo,
            et.RolDocente AS rolDocente,
            CONCAT(d1.Nombre, ' ', d1.ApellidoPaterno, ' ', d1.ApellidoMaterno) AS secretario,
            CONCAT(d2.Nombre, ' ', d2.ApellidoPaterno, ' ', d2.ApellidoMaterno) AS vocal
        FROM ExamenTitulacion et
        INNER JOIN Estudiante e ON e.NumeroControl = et.NumeroControl
        INNER JOIN Docente d1 ON et.ClaveSecretario = d1.ClaveDocente
        INNER JOIN Docente d2 ON et.ClaveVocal = d2.ClaveDocente
        WHERE et.ClaveDocente = @ClaveDocente
          AND YEAR(et.Fecha) = @Año`

      : `SELECT 
            CONCAT(e.Nombre, ' ', e.ApellidoPaterno, ' ', e.ApellidoMaterno) AS nombreAlumno,
            s.NumeroControl AS numeroControl,
            s.FechaExamen AS fechaExamen,
            s.ProgramaEducativo AS programaEducativo,
            s.FolioActa AS folioActa
        FROM SinodaliasTitulacion s
        INNER JOIN Estudiante e ON s.NumeroControl = e.NumeroControl
        WHERE s.ClaveDocente = @ClaveDocente
          AND YEAR(s.FechaExamen) = @Año`
    )

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{ name: 'ClaveDocente', value: claveDocente },
       { name: 'Año', value: año }]
    );

    return result.map(row => ({
      ...base,
      alumno: { 
        nombreCompleto: row.nombreAlumno, 
        numeroControl: row.numeroControl 
      },
      fechaExamen: row.fechaExamen,
      programaEducativo: row.programaEducativo,
      rolDocente: row?.rolDocente || null,
      folioActa: row?.folioActa || null,
      secretario: row?.secretario || null,
      vocal: row?.vocal || null,
    }));
  }

  /**
   * DOC029: Convenio de colaboración académica
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param claveDepartamento: string
   * @param año: number
   */
  async generateConveniosAcademicos(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number
  ): Promise<FileInterfaces.ConvenioColaboracion[]> {
    
    const query = `
      SELECT 
          ca.Institucion1 AS institucion1,
          ca.Institucion2 AS institucion2,
          ca.TipoColaboracion AS tipoConvenio,
          ca.RolDocente AS rolDocente
      FROM Direccion.dbo.ColaboracionAcademica ca
      WHERE ca.ClaveDocente = @ClaveDocente
          AND ca.Año = @Año
    `;

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{ name: 'ClaveDocente', value: claveDocente },
        { name: 'Año', value: año }]
    );

    return result.map(row => ({
      ...base,
      institucion1: row.institucion1,
      institucion2: row.institucion2,
      tipoConvenio: row.tipoConvenio,
      rolDocente: row.rolDocente
    }));
  }

  /**
   * DOC031: Programa de asesorías de ciencias básicas
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param claveDepartamento: string
   * @param año: number
   */
  async generateAsesoriasCienciasBasicas(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number,
  ): Promise<FileInterfaces.ProgramaCienciasBasicas[]> {
    let query = `
      SELECT
          a.Nombre AS asignatura,
          ar.Horario AS horario,
          pa.Modalidad AS modalidad,
          CONCAT(pa.Semestre, ' ', pa.Año) AS periodo
      FROM ProgramaAsesoria pa
      INNER JOIN Asesoria_Asignatura aa 
          ON pa.ClaveAsesoria = aa.ClaveAsesoria
      INNER JOIN Asignatura a ON aa.ClaveAsignatura = a.ClaveAsignatura
      INNER JOIN Asesoria_Registros ar 
          ON pa.ClaveAsesoria = ar.ClaveAsesoria
      WHERE pa.ClaveDocente = @ClaveDocente
          AND pa.Año = @Año`
    ;

    const r = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{ name: 'ClaveDocente', value: claveDocente },
        { name: 'Año', value: año }]
    );

    let asesorias: FileInterfaces.AsesoriaDetalle[] = [];
    r.forEach(row => {
      asesorias.push({
        asignatura: row.asignatura,
        horario: row.horario,
        modalidad: row.modalidad,
        periodo: row.periodo
      })
    })

    const subdireccion = await this.getDepartmentHeadById('DSUBD10');
    return [{
      ...base,
      asesorias,
      subdireccion: subdireccion || null,
      año: año
    }]
  }

  /**
   * DOC032: Constancia por asesoría en ciencias básicas
   * @param base: DocumentInterfaces.Base
   * @param claveDocente: string
   * @param claveDepartamento: string
   * @param año: number
   */
  async generateConstanciaAsesoriaCienciasBasicas(
    base: FileInterfaces.Base,
    claveDocente: string,
    claveDepartamento: string,
    año: number
  ): Promise<FileInterfaces.ConstanciaCienciasBasicas[]> {
    const query = `
      SELECT
          SUM(ar.TotalHoras) AS totalHoras,
          SUM(ar.TotalEstudiantes) AS totalEstudiantes,
          CONCAT(pa.Semestre, ' ', pa.Año) AS periodo
      FROM ProgramaAsesoria pa
      INNER JOIN Asesoria_Asignatura aa 
          ON pa.ClaveAsesoria = aa.ClaveAsesoria
      INNER JOIN Asignatura a ON aa.ClaveAsignatura = a.ClaveAsignatura
      INNER JOIN Asesoria_Registros ar 
          ON pa.ClaveAsesoria = ar.ClaveAsesoria
      WHERE pa.ClaveDocente = @ClaveDocente
          AND pa.Año = @Año
      GROUP BY pa.Semestre, pa.Año`

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{ name: 'ClaveDocente', value: claveDocente },
       { name: 'Año', value: año }]
    );

    return result.map(row => ({
      ...base,
      totalHoras: row.totalHoras,
      totalEstudiantes: row.totalEstudiantes,
      periodo: row.periodo
    }));
  }
}