import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MssqlService } from '@strongnguyen/nestjs-mssql';
import { DynamicDatabaseService } from '../database/dynamic-database.service';
import { UsersService } from '../users/users.service';
import { ActivitiesService } from '../activities/activities.service';
import * as FileInterfaces from './interfaces/files.interface';

interface Expediente {
  claveExpediente: string;
  añoGeneracion: number;
  claveDocente: string;
  documentos: FileInterfaces.GeneratedFile[];
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
  ): Promise<FileInterfaces.GeneratedFile[]> {
    try {
      this.logger.log(`Iniciando generación de archivos para usuario: ${claveUsuario}`);
      
      // Verificar que el usuario existe
      const user = await this.usersService.findByClaveUsuario(claveUsuario);
      if (!user) {
        throw new NotFoundException(`Usuario con clave ${claveUsuario} no encontrado`);
      }
      this.logger.log(`Usuario encontrado: ${user.Correo}`);

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
   * Generar expediente
   * @param claveDocente string
   */
  async generateExpediente(
    claveDocente: string
  ): Promise<Expediente> {
    const añoGeneracion = new Date().getFullYear();
    const año = añoGeneracion;
    const claveExpediente = `${claveDocente}-${añoGeneracion}`;

    await this.deleteExpedienteIfExists(claveExpediente);

    let claveDepartamento: string;
    let base;
    let documentos: FileInterfaces.GeneratedFile[] = [];

    const generation: Record<string, Generator> = {
    
      // ========== DOCUMENTOS 1-32 ==========
      // DOC001: Horarios de asignaturas licenciatura
      'DOC001': () => 
      this.generateHorarioAsignaturasLic(base, claveDocente, claveDepartamento, año, 
      { tipo: 'horarios', nivel: 'licenciatura' }),

// DOC002: Constancia de asignaturas impartidas
'DOC002': () => 
  this.generateConstanciaAsignaturaImp(base, claveDocente, claveDepartamento, año, 
    { tipo: 'constancia', nivel: 'licenciatura' }),

// DOC003: Horarios de asignatura adicional
'DOC003': () => 
  this.generateHorarioAsignaturaAdi(base, claveDocente, claveDepartamento, año, 
    { tipo: 'horarios-adicionales', nivel: 'licenciatura' }),

// DOC004: Constancia de séptima asignatura
'DOC004': () => 
  this.generateConstanciaSeptimaAsignatura(base, claveDocente, claveDepartamento, año, 
    { tipo: 'constancia-adicionales', nivel: 'licenciatura' }),

// DOC005: Horarios de asignaturas posgrado
'DOC005': () => 
  this.generateHorarioAsignaturaPos(base, claveDocente, claveDepartamento, año, 
    { tipo: 'horarios', nivel: 'posgrado' }),

// DOC006: Constancia de asignaturas posgrado
'DOC006': () => 
  this.generateConstanciaAsignaturaPos(base, claveDocente, claveDepartamento, año, 
    { tipo: 'constancia', nivel: 'posgrado' }),

// DOC007: Constancia modalidades de atención
'DOC007': () => 
  this.generateModalidadesAtencion(base, claveDocente, claveDepartamento, año),

// DOC008: Constancia de tutorías PIT
'DOC008': () => 
  this.generateTutorias(base, claveDocente, claveDepartamento, año, 
    { tipo: 'pit' }),

// DOC009: Constancia de acreditación programa
'DOC009': () => 
  this.generateAcreditacionProgramas(base, claveDocente, claveDepartamento, año),

// DOC010: Constancia actividades complementarias
'DOC010': () => 
  this.generateActividadesComplementarias(base, claveDocente, claveDepartamento, año),

// DOC011: Constancia proyecto integrador
'DOC011': () => 
  this.generateProyectosIntegradores(base, claveDocente, claveDepartamento, año),

// DOC012: Constancia manual de prácticas
'DOC012': () => 
  this.generateManualesPracticas(base, claveDocente, claveDepartamento, año),

// DOC013: Constancia estrategias didácticas
'DOC013': () => 
  this.generateEstrategiasDidacticas(base, claveDocente, claveDepartamento, año),

// DOC014: Constancia materiales didácticos inclusivos
'DOC014': () => 
  this.generateMaterialesInclusivos(base, claveDocente, claveDepartamento, año),

// DOC015: Comisión instructor cursos docentes
'DOC015': () => 
  this.generateComCursosCapacitacionDocente(base, claveDocente, claveDepartamento, año, 
    { tipo: 'comision', destinatarios: 'docentes' }),

// DOC016: Constancia curso impartido
'DOC016': () => 
  this.generateConstCursosCapacitacion(base, claveDocente, claveDepartamento, año, 
    { tipo: 'constancia', destinatarios: 'general' }),

// DOC017: Comisión instructor cursos TecNM
'DOC017': () => 
  this.generateComisionInstructor(base, claveDocente, claveDepartamento, año, 
    { tipo: 'comision', destinatarios: 'tecnm' }),

// DOC018: Constancia realización curso TecNM
'DOC018': () => 
  this.generateConstanciaCursoTecnm(base, claveDocente, claveDepartamento, año, 
    { tipo: 'constancia', destinatarios: 'tecnm' }),

// DOC019: Comisión Diplomado Pensamiento Crítico
'DOC019': () => 
  this.generateComisionDiplomados(base, claveDocente, claveDepartamento, año, 
    { tipo: 'comision', nombre: 'pensamiento-critico' }),

// DOC020: Constancia Diplomado Pensamiento Crítico
'DOC020': () => 
  this.generateConstanciaDiplomados(base, claveDocente, claveDepartamento, año, 
    { tipo: 'constancia', nombre: 'pensamiento-critico' }),

// DOC021: Constancia Diplomado Formación Tutores
'DOC021': () => 
  this.generateDiplomadosFormacion(base, claveDocente, claveDepartamento, año, 
    { tipo: 'constancia', nombre: 'formacion-tutores' }),

// DOC022: Comisión Diplomado Recursos Educativos
'DOC022': () => 
  this.generateComisionDiplomadosRecursos(base, claveDocente, claveDepartamento, año, 
    { tipo: 'comision', nombre: 'recursos-educativos' }),

// DOC023: Constancia Diplomado Recursos Educativos
'DOC023': () => 
  this.generateConstanciaDiplomadosRecursos(base, claveDocente, claveDepartamento, año, 
    { tipo: 'constancia', nombre: 'recursos-educativos' }),

// DOC024: Comisión Diplomado Educación Inclusiva
'DOC024': () => 
  this.generateComisionDiplomadosEducacion(base, claveDocente, claveDepartamento, año, 
    { tipo: 'comision', nombre: 'educacion-inclusiva' }),

// DOC025: Constancia Diplomado Educación Inclusiva
'DOC025': () => 
  this.generateConstanciaDiplomadosEducacion(base, claveDocente, claveDepartamento, año, 
    { tipo: 'constancia', nombre: 'educacion-inclusiva' }),

// DOC026: Comisión Diplomados estratégicos
'DOC026': () => 
  this.generateComisionDiplomadosEstrategico(base, claveDocente, claveDepartamento, año, 
    { tipo: 'comision', nombre: 'estrategicos' }),

// DOC027: Constancia Diplomados estratégicos
    'DOC027': () => 
      this.generateConstanciaDiplomadosEstrategico(base, claveDocente, claveDepartamento, año, 
      { tipo: 'constancia', nombre: 'estrategicos' }),

    // DOC028: Acta examen profesional/grado
    'DOC028': () => 
    this.generateActasExamen(base, claveDocente, claveDepartamento, año),

    // DOC029: Convenio colaboración académica
      'DOC029': () => 
         this.generateConveniosAcademicos(base, claveDocente, claveDepartamento, año),

      // DOC030: Constancia sinodal titulación
      'DOC030': () => 
       this.generateSinodalesTitulacion(base, claveDocente, claveDepartamento, año),

      // DOC031: Programa asesoría ciencias básicas
      'DOC031': () => 
       this.generateProgramaAsesoriasCiencias(base, claveDocente, claveDepartamento, año, 
         { tipo: 'programa' }),

      // DOC032: Constancia asesoría ciencias básicas
      'DOC032': () => 
        this.generateConstanciaAsesoriasCiencias(base, claveDocente, claveDepartamento, año, 
        { tipo: 'constancia' }),

       // ========== Primera parte terminada ==========
  



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
        this.generateEvaluaciones(base, claveDocente, claveDepartamento, año, 'desempeño'),
      
      // DOC063: Evaluación de desempeño docente
      'DOC063': () => 
        this.generateEvaluaciones(base, claveDocente, claveDepartamento, año, 'departamental'),
    }
    const departamentos = await this.getAllDepartmentIds();
    
    for (const dep of departamentos) {
      claveDepartamento = dep ?? (await this.getDepartmentByProfessorId(claveDocente));
      const result = await this.getFilesByDepartment(claveDocente, claveDepartamento, año, generation);

      if (result && result.length > 0) {
        documentos.push(...result);
        this.logger.log(`Generados ${result.length} documentos del departamento ${claveDepartamento}`);
      }
    }

    const expediente: Expediente = {
      claveExpediente: claveExpediente ,
      añoGeneracion: añoGeneracion,
      claveDocente: claveDocente,
      documentos: documentos
    }

    await this.insertExpediente(expediente);
    await this.insertGeneratedDocuments(documentos, claveExpediente);
    
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
    ): Promise<FileInterfaces.GeneratedFile[]> {

    const base: FileInterfaces.Base = {
        docente: await this.getProfessorNameById(claveDocente),
        titular: await this.getDepartmentHeadById(claveDepartamento),
        departamento: await this.getDepartmentNameById(claveDepartamento),
        claveDepartamento: claveDepartamento,
      };

    const files = await this.getDocumentsByDepartment(claveDepartamento);
    const docs: FileInterfaces.GeneratedFile[] = [];

    for (const f of files) {
      const result = await generation[f.documento]?.(base, claveDocente, claveDepartamento, año);
      if (result && result.length > 0) {
        docs.push(...result);
      }
    }
    
    return docs;
  }

  // ========== MÉTODOS AUXILIARES ==========
  /**
   * Verificar si un docente solo tiene asignaturas posgrado
   * @param claveDocente string
   * @param claveDepartamento string
   * @param año number
   * @param semeste string
   */
  async checkCourses(
    claveDocente: string,
    claveDepartamento: string,
    año: number,
    semeste: string
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
            AND Semestre = @Semestre`,
      [{ name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año },
      { name: 'Semestre', value: semeste }]
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
    documentos: FileInterfaces.GeneratedFile[],
    claveExpediente: string,
  ) {
    const pool = this.mssql.getPool();
    for (let index = 0; index < documentos.length; index++) {
        const doc = documentos[index];
        await pool
            .request()
            .input('ClaveDocumentoGenerado', `${claveExpediente}-${doc.claveDocumento}-${index + 1}`)
            .input('ClaveExpediente', claveExpediente)
            .input('ClaveDocumento', doc.claveDocumento)
            .input('Contenido', JSON.stringify(doc))
            .query(`
                INSERT INTO DocumentoGenerado (ClaveDocumentoGenerado, ClaveExpediente, ClaveDocumento, Contenido)
                VALUES (@ClaveDocumentoGenerado, @ClaveExpediente, @ClaveDocumento, @Contenido)
            `);
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
        DELETE FROM Expediente
        WHERE ClaveExpediente = @ClaveExpediente
      `);

    await pool
      .request()
      .input('ClaveExpediente', claveExpediente)
      .query(`
        DELETE FROM DocumentoGenerado
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
        SELECT ClaveDocumento as claveDocumento
        FROM SAPEDD.dbo.Actividad_Documento
        WHERE ClaveDepartamento = @ClaveDepartamento
            OR (ClaveDepartamento IS NULL 
                AND NOT EXISTS (
                    SELECT 1 
                    FROM SAPEDD.dbo.Actividad_Documento 
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
    const result = await pool
      .request()
      .input('NombreDepartamento', `%${nombreDepartamento}%`)
      .query(`
        SELECT ClaveDepartamento AS claveDepartamento
        FROM Departamento
        WHERE Nombre LIKE @NombreDepartamento
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
    option: {
      tipo: 'comision' | 'constancia'
      nivel: 'local' | 'nacional' | 'null'
    }
  ): Promise<FileInterfaces.DesarrolloCurricular[]> {
    let query = (
      option.tipo === 'comision'
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
       {name: 'Nivel', value: option.nivel}]
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
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
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
    )

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
      {name: 'Año', value: año}]
    )

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





  // ========== MÉTODOS 1-32 ==========
  // ========== MÉTODOS 1-32 CORREGIDOS ==========

/**
 * DOC001: Horarios de asignaturas licenciatura
 */
async generateHorarioAsignaturasLic(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nivel: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      Semestre AS semestre,
      STRING_AGG(CONCAT(a.NombreAsignatura, ' - ', ad.Horario), '; ') AS horarios
    FROM Asignatura_Docente ad
    INNER JOIN Asignatura a ON a.ClaveAsignatura = ad.ClaveAsignatura
    WHERE ad.ClaveDocente = @ClaveDocente
      AND ad.Año = @Año
      AND a.Nivel = 'LICENCIATURA'
    GROUP BY Semestre
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    semestre: row.semestre,
    horarios: row.horarios
  }));
}

/**
 * DOC002: Constancia de asignaturas impartidas
 */
async generateConstanciaAsignaturaImp(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nivel: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      ad.Semestre AS semestre,
      a.Nivel AS nivel,
      a.NombreAsignatura AS nombreAsignatura,
      a.ClaveAsignatura AS claveAsignatura,
      ad.EstudiantesAtendidos AS estudiantesAtendidos
    FROM Asignatura_Docente ad
    INNER JOIN Asignatura a ON a.ClaveAsignatura = ad.ClaveAsignatura
    WHERE ad.ClaveDocente = @ClaveDocente
      AND ad.Año = @Año
      AND a.Nivel = 'LICENCIATURA'
    ORDER BY ad.Semestre, a.NombreAsignatura
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    semestre: row.semestre,
    nivel: row.nivel,
    nombreAsignatura: row.nombreAsignatura,
    claveAsignatura: row.claveAsignatura,
    estudiantesAtendidos: row.estudiantesAtendidos
  }));
}

/**
 * DOC003: Horarios de asignatura adicional
 */
async generateHorarioAsignaturaAdi(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nivel: string }
): Promise<any[]> {
  
  const query = `
    WITH AsignaturasPorSemestre AS (
      SELECT 
        Semestre,
        a.NombreAsignatura,
        ad.Horario,
        ROW_NUMBER() OVER (PARTITION BY Semestre ORDER BY a.ClaveAsignatura) AS numeroAsignatura
      FROM Asignatura_Docente ad
      INNER JOIN Asignatura a ON a.ClaveAsignatura = ad.ClaveAsignatura
      WHERE ad.ClaveDocente = @ClaveDocente
        AND ad.Año = @Año
    )
    SELECT 
      Semestre AS semestre,
      STRING_AGG(CONCAT(NombreAsignatura, ' - ', Horario), '; ') AS horariosAdicionales
    FROM AsignaturasPorSemestre
    WHERE numeroAsignatura >= 7
    GROUP BY Semestre
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    semestre: row.semestre,
    horariosAdicionales: row.horariosAdicionales
  }));
}

/**
 * DOC004: Constancia de séptima asignatura
 */
async generateConstanciaSeptimaAsignatura(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nivel: string }
): Promise<any[]> {
  
  const query = `
    WITH AsignaturasNumeradas AS (
      SELECT 
        ad.Semestre,
        a.Nivel,
        a.NombreAsignatura,
        a.ClaveAsignatura,
        ad.EstudiantesAtendidos,
        ROW_NUMBER() OVER (PARTITION BY ad.Semestre ORDER BY a.ClaveAsignatura) AS numeroAsignatura
      FROM Asignatura_Docente ad
      INNER JOIN Asignatura a ON a.ClaveAsignatura = ad.ClaveAsignatura
      WHERE ad.ClaveDocente = @ClaveDocente
        AND ad.Año = @Año
    )
    SELECT 
      Semestre AS semestre,
      Nivel AS nivel,
      NombreAsignatura AS nombreAsignatura,
      ClaveAsignatura AS claveAsignatura,
      EstudiantesAtendidos AS estudiantesAtendidos
    FROM AsignaturasNumeradas
    WHERE numeroAsignatura >= 7
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    semestre: row.semestre,
    nivel: row.nivel,
    nombreAsignatura: row.nombreAsignatura,
    claveAsignatura: row.claveAsignatura,
    estudiantesAtendidos: row.estudiantesAtendidos
  }));
}

/**
 * DOC005: Horarios de asignaturas posgrado
 */
async generateHorarioAsignaturaPos(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nivel: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      Semestre AS semestre,
      STRING_AGG(CONCAT(a.NombreAsignatura, ' - ', ad.Horario), '; ') AS horarios
    FROM Asignatura_Docente ad
    INNER JOIN Asignatura a ON a.ClaveAsignatura = ad.ClaveAsignatura
    WHERE ad.ClaveDocente = @ClaveDocente
      AND ad.Año = @Año
      AND a.Nivel = 'POSGRADO'
    GROUP BY Semestre
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    semestre: row.semestre,
    horarios: row.horarios
  }));
}

/**
 * DOC006: Constancia de asignaturas posgrado
 */
async generateConstanciaAsignaturaPos(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nivel: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      ad.Semestre AS semestre,
      a.NombreAsignatura AS nombreAsignatura,
      a.Tipo AS tipoAsignatura,
      a.ClaveAsignatura AS claveAsignatura,
      ad.EstudiantesAtendidos AS estudiantesAtendidos
    FROM Asignatura_Docente ad
    INNER JOIN Asignatura a ON a.ClaveAsignatura = ad.ClaveAsignatura
    WHERE ad.ClaveDocente = @ClaveDocente
      AND ad.Año = @Año
      AND a.Nivel = 'POSGRADO'
    ORDER BY ad.Semestre, a.NombreAsignatura
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    semestre: row.semestre,
    nombreAsignatura: row.nombreAsignatura,
    tipoAsignatura: row.tipoAsignatura,
    claveAsignatura: row.claveAsignatura,
    estudiantesAtendidos: row.estudiantesAtendidos
  }));
}

/**
 * DOC007: Constancia modalidades de atención
 */
async generateModalidadesAtencion(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number
): Promise<any[]> {
  
  const query = `
    SELECT 
      ad.Semestre AS semestre,
      a.Nivel AS nivel,
      a.NombreAsignatura AS nombreAsignatura,
      a.ClaveAsignatura AS claveAsignatura,
      ad.EstudiantesEscolarizada AS estudiantesEscolarizada,
      ad.EstudiantesNoEscolarizada AS estudiantesNoEscolarizada,
      ad.EstudiantesMixta AS estudiantesMixta
    FROM Asignatura_Docente ad
    INNER JOIN Asignatura a ON a.ClaveAsignatura = ad.ClaveAsignatura
    WHERE ad.ClaveDocente = @ClaveDocente
      AND ad.Año = @Año
    ORDER BY ad.Semestre, a.NombreAsignatura
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    semestre: row.semestre,
    nivel: row.nivel,
    nombreAsignatura: row.nombreAsignatura,
    claveAsignatura: row.claveAsignatura,
    estudiantesEscolarizada: row.estudiantesEscolarizada,
    estudiantesNoEscolarizada: row.estudiantesNoEscolarizada,
    estudiantesMixta: row.estudiantesMixta
  }));

  }
  /**
 * DOC008: Constancia de tutorías PIT
 */
async generateTutorias(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      Semestre AS semestre,
      COUNT(DISTINCT ClaveEstudiante) AS estudiantesAtendidos
    FROM Tutorias
    WHERE ClaveDocente = @ClaveDocente
      AND Año = @Año
      AND Programa = 'PIT'
    GROUP BY Semestre
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    semestre: row.semestre,
    estudiantesAtendidos: row.estudiantesAtendidos
  }));
}

/**
 * DOC009: Constancia de acreditación programa
 */
async generateAcreditacionProgramas(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number
): Promise<any[]> {
  
  const query = `
    SELECT DISTINCT
      p.NombrePrograma AS nombrePrograma,
      pa.OrganismoAcreditador AS organismoAcreditador,
      pa.FechaAcreditacion AS fechaAcreditacion,
      pa.FechaVigencia AS fechaVigencia,
      pa.NumeroRegistroSNP AS numeroRegistroSNP
    FROM ProgramaAcreditado pa
    INNER JOIN Programa p ON p.ClavePrograma = pa.ClavePrograma
    INNER JOIN Asignatura_Docente ad ON ad.ClavePrograma = p.ClavePrograma
    WHERE ad.ClaveDocente = @ClaveDocente
      AND ad.Año = @Año
      AND pa.Estatus = 'VIGENTE'
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombrePrograma: row.nombrePrograma,
    organismoAcreditador: row.organismoAcreditador,
    fechaAcreditacion: row.fechaAcreditacion,
    fechaVigencia: row.fechaVigencia,
    numeroRegistroSNP: row.numeroRegistroSNP
  }));
}

/**
 * DOC010: Constancia actividades complementarias
 */
async generateActividadesComplementarias(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number
): Promise<any[]> {
  
  const query = `
    SELECT 
      ac.NombreActividad AS nombreActividad,
      ac.NumeroDictamen AS numeroDictamen,
      ac.Creditos AS creditos,
      ac.EstudiantesAtendidos AS estudiantesAtendidos
    FROM ActividadComplementaria ac
    WHERE ac.ClaveDocente = @ClaveDocente
      AND ac.Año = @Año
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreActividad: row.nombreActividad,
    numeroDictamen: row.numeroDictamen,
    creditos: row.creditos,
    estudiantesAtendidos: row.estudiantesAtendidos
  }));
}

/**
 * DOC011: Constancia proyecto integrador
 */
async generateProyectosIntegradores(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number
): Promise<any[]> {
  
  const query = `
    SELECT 
      pi.NombreProyecto AS nombreProyecto,
      STRING_AGG(a.NombreAsignatura, ', ') AS asignaturasIntegradas
    FROM ProyectoIntegrador pi
    INNER JOIN ProyectoIntegrador_Asignatura pia ON pia.ClaveProyecto = pi.ClaveProyecto
    INNER JOIN Asignatura a ON a.ClaveAsignatura = pia.ClaveAsignatura
    WHERE pi.ClaveDocente = @ClaveDocente
      AND pi.Año = @Año
    GROUP BY pi.NombreProyecto
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreProyecto: row.nombreProyecto,
    asignaturasIntegradas: row.asignaturasIntegradas
  }));
}

/**
 * DOC012: Constancia manual de prácticas
 */
async generateManualesPracticas(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number
): Promise<any[]> {
  
  const query = `
    SELECT 
      mp.NombreManual AS nombreManual,
      mp.FechaElaboracion AS fechaElaboracion,
      mp.Estatus AS estatus
    FROM ManualPracticas mp
    WHERE mp.ClaveDocente = @ClaveDocente
      AND YEAR(mp.FechaElaboracion) = @Año
      AND mp.Estatus = 'EN_USO'
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreManual: row.nombreManual,
    fechaElaboracion: row.fechaElaboracion,
    estatus: row.estatus
  }));
}

/**
 * DOC013: Constancia estrategias didácticas
 */
async generateEstrategiasDidacticas(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number
): Promise<any[]> {
  
  const query = `
    SELECT 
      ed.NombreAsignatura AS nombreAsignatura,
      ed.ProductosObtenidos AS productosObtenidos,
      ed.ImpactoExperiencias AS impactoExperiencias
    FROM EstrategiaDidactica ed
    WHERE ed.ClaveDocente = @ClaveDocente
      AND ed.Año = @Año
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreAsignatura: row.nombreAsignatura,
    productosObtenidos: row.productosObtenidos,
    impactoExperiencias: row.impactoExperiencias
  }));
}

/**
 * DOC014: Constancia materiales didácticos inclusivos
 */
async generateMaterialesInclusivos(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number
): Promise<any[]> {
  
  const query = `
    SELECT 
      mdi.Enfoque AS enfoque,
      mdi.ProductosObtenidos AS productosObtenidos,
      mdi.ImpactoExperiencias AS impactoExperiencias
    FROM MaterialDidacticoInclusivo mdi
    WHERE mdi.ClaveDocente = @ClaveDocente
      AND mdi.Año = @Año
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    enfoque: row.enfoque,
    productosObtenidos: row.productosObtenidos,
    impactoExperiencias: row.impactoExperiencias
  }));
}

/**
 * DOC015: Comisión instructor cursos docentes
 */
async generateComCursosCapacitacionDocente(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; destinatarios: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      c.NombreCurso AS nombreCurso,
      c.TipoCurso AS tipoCurso,
      c.HorasDuracion AS horasDuracion,
      c.FechaInicio AS fechaInicio,
      c.FechaFin AS fechaFin
    FROM ComisionCurso c
    WHERE c.ClaveDocente = @ClaveDocente
      AND YEAR(c.FechaInicio) = @Año
      AND c.Destinatarios = 'DOCENTES_TECNM'
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreCurso: row.nombreCurso,
    tipoCurso: row.tipoCurso,
    horasDuracion: row.horasDuracion,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin
  }));
}

/**
 * DOC016: Constancia curso impartido
 */
async generateConstCursosCapacitacion(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; destinatarios: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      ci.NombreCurso AS nombreCurso,
      ci.NumeroRegistro AS numeroRegistro,
      ci.FechaInicio AS fechaInicio,
      ci.FechaFin AS fechaFin,
      ci.HorasDuracion AS horasDuracion
    FROM CursoImpartido ci
    WHERE ci.ClaveDocente = @ClaveDocente
      AND YEAR(ci.FechaInicio) = @Año
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreCurso: row.nombreCurso,
    numeroRegistro: row.numeroRegistro,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin,
    horasDuracion: row.horasDuracion
  }));
}

/**
 * DOC017: Comisión instructor cursos TecNM
 */
async generateComisionInstructor(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; destinatarios: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      c.NombreCurso AS nombreCurso,
      c.HorasDuracion AS horasDuracion,
      c.FechaInicio AS fechaInicio,
      c.FechaFin AS fechaFin
    FROM ComisionCurso c
    WHERE c.ClaveDocente = @ClaveDocente
      AND YEAR(c.FechaInicio) = @Año
      AND c.Programa = 'FORMACION_DOCENTE_TECNM'
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreCurso: row.nombreCurso,
    horasDuracion: row.horasDuracion,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin
  }));
}

/**
 * DOC018: Constancia realización curso TecNM
 */
async generateConstanciaCursoTecnm(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; destinatarios: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      c.NombreCurso AS nombreCurso,
      c.HorasDuracion AS horasDuracion,
      c.ProfesoresBeneficiados AS profesoresBeneficiados
    FROM CursoTecNM c
    WHERE c.ClaveDocente = @ClaveDocente
      AND c.Año = @Año
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreCurso: row.nombreCurso,
    horasDuracion: row.horasDuracion,
    profesoresBeneficiados: row.profesoresBeneficiados
  }));
}

/**
 * DOC019: Comisión Diplomado Pensamiento Crítico
 */
async generateComisionDiplomados(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nombre: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      d.NombreDiplomado AS nombreDiplomado,
      d.FechaInicio AS fechaInicio,
      d.FechaFin AS fechaFin
    FROM ComisionDiplomado d
    WHERE d.ClaveDocente = @ClaveDocente
      AND YEAR(d.FechaInicio) = @Año
      AND d.NombreDiplomado LIKE '%Pensamiento Crítico%'
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreDiplomado: row.nombreDiplomado,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin
  }));
}

/**
 * DOC020: Constancia Diplomado Pensamiento Crítico
 */
async generateConstanciaDiplomados(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nombre: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      d.NombreModulo AS nombreModulo,
      d.HorasImpartidas AS horasImpartidas
    FROM DiplomadoImpartido d
    WHERE d.ClaveDocente = @ClaveDocente
      AND d.Año = @Año
      AND d.NombreDiplomado LIKE '%Pensamiento Crítico%'
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreModulo: row.nombreModulo,
    horasImpartidas: row.horasImpartidas
  }));
}

/**
 * DOC021: Constancia Diplomado Formación Tutores
 */
async generateDiplomadosFormacion(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nombre: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      d.NombreModulo AS nombreModulo,
      d.HorasImpartidas AS horasImpartidas
    FROM DiplomadoImpartido d
    WHERE d.ClaveDocente = @ClaveDocente
      AND d.Año = @Año
      AND d.NombreDiplomado LIKE '%Formación de Tutores%'
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreModulo: row.nombreModulo,
    horasImpartidas: row.horasImpartidas
  }));
}

/**
 * DOC022: Comisión Diplomado Recursos Educativos
 */
async generateComisionDiplomadosRecursos(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nombre: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      d.NombreDiplomado AS nombreDiplomado,
      d.FechaInicio AS fechaInicio,
      d.FechaFin AS fechaFin
    FROM ComisionDiplomado d
    WHERE d.ClaveDocente = @ClaveDocente
      AND YEAR(d.FechaInicio) = @Año
      AND d.NombreDiplomado LIKE '%Recursos Educativos%'
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreDiplomado: row.nombreDiplomado,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin
  }));
}

/**
 * DOC023: Constancia Diplomado Recursos Educativos
 */
async generateConstanciaDiplomadosRecursos(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nombre: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      d.NombreModulo AS nombreModulo,
      d.HorasImpartidas AS horasImpartidas
    FROM DiplomadoImpartido d
    WHERE d.ClaveDocente = @ClaveDocente
      AND d.Año = @Año
      AND d.NombreDiplomado LIKE '%Recursos Educativos%'
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreModulo: row.nombreModulo,
    horasImpartidas: row.horasImpartidas
  }));
}

/**
 * DOC024: Comisión Diplomado Educación Inclusiva
 */
async generateComisionDiplomadosEducacion(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nombre: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      d.NombreDiplomado AS nombreDiplomado,
      d.FechaInicio AS fechaInicio,
      d.FechaFin AS fechaFin
    FROM ComisionDiplomado d
    WHERE d.ClaveDocente = @ClaveDocente
      AND YEAR(d.FechaInicio) = @Año
      AND d.NombreDiplomado LIKE '%Educación Inclusiva%'
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreDiplomado: row.nombreDiplomado,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin
  }));
}

/**
 * DOC025: Constancia Diplomado Educación Inclusiva
 */
async generateConstanciaDiplomadosEducacion(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nombre: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      d.NombreModulo AS nombreModulo,
      d.HorasImpartidas AS horasImpartidas
    FROM DiplomadoImpartido d
    WHERE d.ClaveDocente = @ClaveDocente
      AND d.Año = @Año
      AND d.NombreDiplomado LIKE '%Educación Inclusiva%'
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreModulo: row.nombreModulo,
    horasImpartidas: row.horasImpartidas
  }));
}

/**
 * DOC026: Comisión Diplomados estratégicos
 */
async generateComisionDiplomadosEstrategico(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nombre: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      d.NombreDiplomado AS nombreDiplomado,
      d.ProyectoEstrategico AS proyectoEstrategico,
      d.FechaInicio AS fechaInicio,
      d.FechaFin AS fechaFin
    FROM ComisionDiplomado d
    WHERE d.ClaveDocente = @ClaveDocente
      AND YEAR(d.FechaInicio) = @Año
      AND d.ProyectoEstrategico IS NOT NULL
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreDiplomado: row.nombreDiplomado,
    proyectoEstrategico: row.proyectoEstrategico,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin
  }));
}

/**
 * DOC027: Constancia Diplomados estratégicos
 */
async generateConstanciaDiplomadosEstrategico(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string; nombre: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      d.NombreDiplomado AS nombreDiplomado,
      d.ProyectoEstrategico AS proyectoEstrategico,
      d.HorasImpartidas AS horasImpartidas
    FROM DiplomadoImpartido d
    WHERE d.ClaveDocente = @ClaveDocente
      AND d.Año = @Año
      AND d.ProyectoEstrategico IS NOT NULL
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreDiplomado: row.nombreDiplomado,
    proyectoEstrategico: row.proyectoEstrategico,
    horasImpartidas: row.horasImpartidas
  }));
}

/**
 * DOC028: Acta examen profesional/grado
 */
async generateActasExamen(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number
): Promise<any[]> {
  
  const query = `
    SELECT 
      ae.Fecha AS fecha,
      ae.NombreEstudiante AS nombreEstudiante,
      ae.Programa AS programa,
      ae.Funcion AS funcion,
      ae.NumeroActa AS numeroActa
    FROM ActaExamen ae
    WHERE ae.ClaveDocente = @ClaveDocente
      AND YEAR(ae.Fecha) = @Año
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    fecha: row.fecha,
    nombreEstudiante: row.nombreEstudiante,
    programa: row.programa,
    funcion: row.funcion,
    numeroActa: row.numeroActa
  }));
}

/**
 * DOC029: Convenio colaboración académica
 */
async generateConveniosAcademicos(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number
): Promise<any[]> {
  
  const query = `
    SELECT 
      ca.Institucion1 AS institucion1,
      ca.Institucion2 AS institucion2,
      ca.TipoColaboracion AS tipoColaboracion,
      ca.Funcion AS funcion,
      ca.Proyecto AS proyecto,
      ca.FechaFirma AS fechaFirma
    FROM ConvenioAcademico ca
    WHERE ca.ClaveDocente = @ClaveDocente
      AND YEAR(ca.FechaFirma) = @Año
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    institucion1: row.institucion1,
    institucion2: row.institucion2,
    tipoColaboracion: row.tipoColaboracion,
    funcion: row.funcion,
    proyecto: row.proyecto,
    fechaFirma: row.fechaFirma
  }));
}

/**
 * DOC030: Constancia sinodal titulación
 */
async generateSinodalesTitulacion(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number
): Promise<any[]> {
  
  const query = `
    SELECT 
      st.NombreEstudiante AS nombreEstudiante,
      st.Programa AS programa,
      st.FolioActa AS folioActa,
      st.FechaExamen AS fechaExamen,
      st.TipoExamen AS tipoExamen
    FROM SinodalTitulacion st
    WHERE st.ClaveDocente = @ClaveDocente
      AND YEAR(st.FechaExamen) = @Año
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    nombreEstudiante: row.nombreEstudiante,
    programa: row.programa,
    folioActa: row.folioActa,
    fechaExamen: row.fechaExamen,
    tipoExamen: row.tipoExamen
  }));
}

/**
 * DOC031: Programa asesoría ciencias básicas
 */
async generateProgramaAsesoriasCiencias(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      pa.Horarios AS horarios,
      STRING_AGG(a.NombreAsignatura, ', ') AS asignaturas,
      pa.Modalidad AS modalidad
    FROM ProgramaAsesoria pa
    INNER JOIN Asesoria_Asignatura aa ON aa.ClavePrograma = pa.ClavePrograma
    INNER JOIN Asignatura a ON a.ClaveAsignatura = aa.ClaveAsignatura
    WHERE pa.ClaveDocente = @ClaveDocente
      AND pa.Año = @Año
    GROUP BY pa.Horarios, pa.Modalidad
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    horarios: row.horarios,
    asignaturas: row.asignaturas,
    modalidad: row.modalidad
  }));
}

/**
 * DOC032: Constancia asesoría ciencias básicas
 */
async generateConstanciaAsesoriasCiencias(
  base: FileInterfaces.Base,
  claveDocente: string,
  claveDepartamento: string,
  año: number,
  config: { tipo: string }
): Promise<any[]> {
  
  const query = `
    SELECT 
      pa.Periodo AS periodo,
      pa.EstudiantesAtendidos AS estudiantesAtendidos,
      pa.TotalHoras AS totalHoras
    FROM ProgramaAsesoria pa
    WHERE pa.ClaveDocente = @ClaveDocente
      AND pa.Año = @Año
  `;

  const result = await this.dynamicDb.executeQueryByDepartmentId(
    claveDepartamento,
    query,
    [
      { name: 'ClaveDocente', value: claveDocente },
      { name: 'Año', value: año }
    ]
  );

  return result.map(row => ({
    ...base,
    periodo: row.periodo,
    estudiantesAtendidos: row.estudiantesAtendidos,
    totalHoras: row.totalHoras
  }));


}

  }
