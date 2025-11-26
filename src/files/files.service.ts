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
        FROM Actividad_Documento
        WHERE ClaveDepartamento = @ClaveDepartamento 
          OR ClaveDepartamento IS NULL
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
      subdireccion: titular || null,
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
      subdireccion: titular || null,
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
      subdireccion: titular || null,
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
            END AS comite
            ce.Tipo AS tipo
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
      subdireccion: titular || null,
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
          WHERE ap.ClaveDocente = @ClaveDocente
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
      plaza: row.plaza,
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
      direccion: direccion || null,
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
      estado: row.estado,
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
        and YEAR(le.FechaInicio) = @Año
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
      claveOficioAutorizacion: row.claveOficioAutorizacion,
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
      estado: row.estado,
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
      porcentajeEstudiantado: row?.porcentajeEstudiantado ?? null,
    }));
  }
}