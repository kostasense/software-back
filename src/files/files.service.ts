import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MssqlService } from '@strongnguyen/nestjs-mssql';
import { DynamicDatabaseService } from '../database/dynamic-database.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly mssql: MssqlService,
    private readonly dynamicDb: DynamicDatabaseService,
    private readonly usersService: UsersService,
  ) {}

  async generateFiles(claveUsuario: string) {
    try {
      this.logger.log(`Iniciando generación de archivos para usuario: ${claveUsuario}`);
      
      // Verificar que el usuario existe
      const user = await this.usersService.findByClaveUsuario(claveUsuario);
      if (!user) {
        throw new NotFoundException(`Usuario con clave ${claveUsuario} no encontrado`);
      }

      this.logger.log(`Usuario encontrado: ${user.Correo}`);
      
      // Implementación pendiente
      throw new Error('Método generateFiles no implementado');

    } catch (error) {
      this.logger.error(`Error en generateFiles: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ========== MÉTODOS AUXILIARES ==========
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

    return result.recordset[0] || null;
  }

  /**
   * Obtener clave de departamento por clave de docente
   * @param claveDocente: string
   */
  async getDepartmentId(claveDocente: string) {
    const pool = this.mssql.getPool();
    const result = await pool
      .request()
      .input('ClaveDocente', claveDocente)
      .query(`
        SELECT ClaveDepartamento AS claveDepartamento
        FROM Docente
        WHERE ClaveDocente = @ClaveDocente
      `);

    return result.recordset[0]?.claveDepartamento ?? null;
  }

  /**
   * Verificar si el docente solo tiene asignaturas posgrado
   * @param claveDocente: string
   * @param año: number
   */
  async isPostgraduateOnly(claveDocente: string, año: number, semestre: string) {
    const claveDepartamento = await this.getDepartmentId(claveDocente);
    const query = `
      SELECT ad.ClaveDocente
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
            AND ad.Año = @Año
            AND ad.Semestre = @Semestre
      )
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente}, 
       {name: 'Año', value: año},
       {name: 'Semestre', value: semestre}]
    ) 

    return (result.length === 0 ? false : true);
  }

  // ========== MÉTODOS ESPECIFICOS POR DOCUMENTO ==========
  
  /**
   * DOC033: Comisión por asesoría en concursos
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc033(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        e.NombreEvento AS nombreEvento,
        ae.FechaInicio AS FechaInicio, 
        ae.FechaFin AS FechaFin
      FROM AsesoriaEvento ae
      INNER JOIN Evento e ON e.ClaveEvento = ae.ClaveEvento
      WHERE ae.ClaveDocente = @ClaveDocente
        AND YEAR(e.FechaInicio) = @Año
    ` 

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente}, 
       {name: 'Año', value: año}]
    ) 

    return (result.length === 0 ? null : {
      asesoriasEventos: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

    /**
   * DOC034: Constancia por asesoría en concursos
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc034(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        e.NombreConcurso [NOMBRE_EVENTO], 
        e.Ubicacion [UBICACION], 
        ae.FechaInicio [FECHA_INICIO], 
        ae.FechaFin [FECHA_FIN]
      FROM AsesoriaEvento ae
      INNER JOIN Evento e ON e.ClaveEvento = ae.ClaveEvento
      WHERE ae.ClaveDocente = @ClaveDocente
        AND YEAR(ae.FechaInicio) = @Año
    ` 

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente}, 
       {name: 'Año', value: año}]
    ) 

    return (result.length === 0 ? null : {
      asesoriasEventos: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC035: Comisión por asesoría en proyectos premiados en concurso
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc035(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        e.NombreEvento AS nombreEvento, 
        ae.FechaInicio AS fechaInicio, 
        ae.FechaFin AS fechaFin
      FROM AsesoriaEvento ae
      INNER JOIN Evento e ON e.ClaveEvento = ae.ClaveEvento
      INNER JOIN Asesoria_ProyectoPremiado app ON app.ClaveAsesoria = ae.ClaveAsesoria
      WHERE ae.claveDocente = @ClaveDocente
        AND YEAR(ae.FechaInicio) = @Año
      `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      proyectosPremiados: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC036: Constancia por asesoría en proyectos premiados en concurso
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc036(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        e.NombreConcurso AS nombreConcurso, 
        ae.NombreProyecto AS nombreProyecto,
        app.LugarPremiado AS lugarPremiado
      FROM AsesoriaEvento ae
      INNER JOIN Evento e ON e.ClaveEvento = ae.ClaveEvento
      INNER JOIN Asesoria_ProyectoPremiado app ON app.ClaveAsesoria = ae.ClaveAsesoria
      WHERE ae.ClaveDocente = @ClaveDocente
          AND YEAR(ae.FechaInicio) = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      proyectosPremiados: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC037: Comisión por coordinación en eventos
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc037(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        e.NombreEvento AS nombreEvento,
        e.FechaInicio AS fechaInicio,
        e.FechaFin AS fechaFin
      FROM ColaboracionEvento ce
      INNER JOIN Evento e ON e.ClaveEvento = ce.ClaveEvento
      WHERE ce.ClaveDocente = @ClaveDocente
          AND YEAR(e.FechaInicio) = @Año
      `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      coordinacionEventos: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC038: Constancia por coordinación en eventos
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc038(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
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
        e.FechaFin 
      `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      coordinacionEventos: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC039: Comisión para participar como jurado en eventos
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc039(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        e.NombreEvento AS nombreEvento,
        e.FechaInicio AS fechaInicio,
        e.Ubicacion AS lugar
      FROM ParticipacionConcurso_Jurado pcj
      INNER JOIN Evento e ON e.ClaveEvento = pcj.ClaveEvento
      WHERE pcj.ClaveDocente = @ClaveDocente
          AND YEAR(e.FechaInicio) = @Año
      `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      juradoEventos: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC040: Constancia por participar como jurado en eventos
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc040(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        e.NombreEvento AS nombreEvento,
        pcj.Categoria AS categoria
      FROM ParticipacionConcurso_Jurado pcj
      INNER JOIN Evento e ON e.ClaveEvento = pcj.ClaveEvento
      WHERE pcj.ClaveDocente = @ClaveDocente
          AND YEAR(e.FechaInicio) = @Año
      `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      juradoEventos: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC041: Comisión para participar en comités de evaluación
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc041(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT
        CASE 
          WHEN ce.Tipo LIKE '%evaluación%'
          THEN 'EVALUACIÓN'
          ELSE 'ACREDITACIÓN'
        END AS comité
        ce.Tipo AS tipo
        ce.Organismo AS organismo
      FROM ComiteEvaluador ce
      WHERE ce.ClaveDocente = @ClaveDocente
        AND Año = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      comites: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC042: Constancia por participación en comités de evaluación
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc042(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        ce.Tipo AS tipo,
        ce.Organismo AS organismo
      FROM ComiteEvaluador ce
      WHERE ce.ClaveDocente = @ClaveDocente
        AND Año = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      comites: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC043: Comisión para auditorías
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc043(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT a.TipoSistema AS tipoSistema
      FROM Auditoria a
      where a.ClaveDocente = @ClaveDocente
          and YEAR(a.FechaInicio) = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      auditorias: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC044: Constancia por auditorías
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc044(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        a.FuncionDocente AS funcionDocente,
        a.TipoSistema AS tipoSistema,
        a.FechaInicio AS fechaInicio,
        a.FechaFin AS fechaFin,
        a.Lugar AS lugar
      FROM Auditoria a
      WHERE a.ClaveDocente = @ClaveDocente
        AND YEAR(a.FechaInicio) = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      auditorias: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC045: Comisión para elaboración de planes y programas
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc045(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        ep.FechaInicio AS fechaInicio,
        ep.FechaFin AS fechaFin
      FROM ElaboracionPlan ep
      WHERE ep.ClaveDocente = @ClaveDocente
        AND YEAR(ep.FechaInicio) = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      planes: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC046: Constancia por elaboración de planes y programas (local)
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc046(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        p.NombrePrograma AS nombrePrograma,
        ep.FechaInicio AS fechaInicio,
        ep.FechaFin AS fechaFin
      FROM ElaboracionPlan ep
      INNER JOIN Programa p ON p.ClavePrograma = ep.ClavePrograma
      WHERE ep.ClaveDocente = @ClaveDocente
        AND ep.Nivel = 'LOCAL'
        AND YEAR(ep.FechaInicio) = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      planes: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC047: Constancia por elaboración de planes y programas (nacional)
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc047(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
    SELECT 
      p.NombrePrograma AS nombrePrograma,
      ep.FechaInicio AS fechaInicio,
      ep.FechaFin AS fechaFin
    FROM ElaboracionPlan ep
    INNER JOIN Programa p on p.ClavePrograma = ep.ClavePrograma
    WHERE ep.ClaveDocente = @ClaveDocente
      AND ep.Nivel = 'NACIONAL'
      AND YEAR(ep.FechaInicio) = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      planes: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }
  

  /**
   * DOC048: Comisión para la elaboración de módulos de especialidad
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc048(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        p.NombrePrograma AS nombrePrograma,
        eme.FechaInicio AS fechaInicio,
        eme.FechaFin AS fechaFin
      FROM ElaboracionModuloEspecialidad eme
      INNER JOIN Programa p ON p.ClavePrograma = eme.ClavePrograma
      WHERE eme.ClaveDocente = @ClaveDocente
          AND YEAR(eme.FechaInicio) = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      modulos: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC049: Registro de modulos de especialidad
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc049(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        STRING_AGG(lm.NombreModulo, ', ') AS modulos,
        p.NombrePrograma AS nombrePrograma
      FROM ElaboracionModuloEspecialidad eme
      INNER JOIN ListaModulo lm ON eme.ClaveRegistro = lm.ClaveRegistro
      INNER JOIN Programa p ON p.ClavePrograma = eme.ClavePrograma
      WHERE eme.ClaveDocente = @ClaveDocente
        AND eme.Nivel = 'LICENCIATURA'
        AND YEAR(eme.FechaInicio) = @Año
      GROUP BY p.NombrePrograma, 
        eme.ClaveDocente
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      modulos: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

    /**
   * DOC050: Constancia por la elaboracion de modulos de especialidad
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc050(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        STRING_AGG(lm.NombreModulo, ', ') AS modulos,
        p.NombrePrograma AS programa
      FROM ElaboracionModuloEspecialidad eme
      INNER JOIN ListaModulo lm ON eme.ClaveRegistro = lm.ClaveRegistro
      INNER JOIN Programa p ON p.ClavePrograma = eme.ClavePrograma
      WHERE eme.ClaveDocente = (inputCLAVE)
        AND eme.Nivel LIKE 'licenciatura'
        AND YEAR(eme.FechaInicio) = (inputAÑO)
      GROUP BY p.NombrePrograma, 
        eme.ClaveDocente
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      modulos: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC051: Comisión para la apertura de programas
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc051(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        ap.NombrePrograma AS nombrePrograma,
        ap.Nivel AS nivel,
        ap.FechaInicio AS fechaInicio,
        ap.FechaFin AS fechaFin
      FROM AperturaPrograma ap
      WHERE ap.ClaveDocente = @ClaveDocente
          AND YEAR(ap.FechaInicio) = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      programas: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC052: Constancia por la apertura de programas
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc052(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
    SELECT 
      ap.NombrePrograma AS nombrePrograma,
      ap.Nivel AS nivel,
      STRING_AGG(CONCAT(d.Nombre, ' ', d.ApellidoPaterno, ' ', d.ApellidoMaterno), ', ') AS docentes
    FROM AperturaPrograma ap
    INNER JOIN ListaDocentes ld ON ld.ClavePrograma = ap.ClavePrograma
    INNER JOIN Docente d ON d.ClaveDocente = ld.ClaveDocente
    WHERE ap.ClavePrograma IN (
      SELECT ClavePrograma 
      FROM ListaDocentes 
      WHERE ClaveDocente = (inputCLAVE)
    ) AND YEAR(ap.FechaInicio) = (inputAÑO)
    GROUP BY 
      ap.NombrePrograma,
      ap.Nivel,
      ap.FechaInicio
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      programas: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC053: Autorización para la apertura de programas
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc053(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        ap.NombrePrograma AS nombrePrograma,
        ap.Nivel AS nivel,
        ap.ClavePrograma AS clavePrograma,
        pa.Modalidad AS modalidad
      FROM ProgramaAprobado pa
      INNER JOIN AperturaPrograma ap ON ap.ClavePrograma = pa.ClavePrograma
      INNER JOIN ListaDocentes ld ON ld.ClavePrograma = ap.ClavePrograma
      WHERE ld.ClaveDocente = @ClaveDocente
          AND YEAR(pa.Fecha) = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      programas: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC054: Constancia de prestación de servicios docentes
   * @param claveDocente: string
   * @param claveDepartamento: string
   */
  async generateDoc054(claveDocente: string, claveDepartamento: string) {
    const query = `
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

    return (result.length === 0 ? null : {
      prestacionServicios: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC055: Carta de exclusividad laboral
   * @param claveDocente: string
   * @param claveDepartamento: string
   */
  async generateDoc055(claveDocente: string, claveDepartamento: string) {
    const query = `
      SELECT 
        d.RFC AS rfc,
        d.ClavePresupuestal AS clavePresupuestal
      FROM Docente d
      WHERE d.ClaveDocente = @ClaveDocente
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente}]
    )

    return (result.length === 0 ? null : {
      prestacionServicios: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC056: Constancia de proyecto de investigación vigente
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc056(claveDocente: string, año: number, claveDepartamento: string) {
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

    return (result.length === 0 ? null : {
      proyectos: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }
  
  /**
   * DOC057: Curriculum vitae de actualizado
   * @param claveDocente: string
   * @param claveDepartamento: string
   */
  async generateDoc057(claveDocente: string, claveDepartamento: string) {
    const query = `
      SELECT
        d.CVUEstado [CVU_ESTADO]
      FROM Docente d
      WHERE d.ClaveDocente = @ClaveDocente
          AND d.CVUEstado = 'VIGENTE'
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente}]
    )

    return (result.length === 0 ? null : {
      curriculum: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC058: Autorización de licencias especiales
   * @param claveDocente: string
   * @param claveDepartamento: string
   */
  async generateDoc058(claveDocente: string, claveDepartamento: string) {
    const query = `
      SELECT 
        le.TipoLicencia [TIPO_LICENCIA],
        le.FechaInicio [FECHA_INICIO],
        le.FechaFin [FECHA_FIN],
        le.ClaveOficioAutorizacion [CLAVE_OFICIO_AUTORIZACION]
      FROM LicenciaEspecial le
      WHERE le.ClaveDocente = @ClaveDocente
        and YEAR(le.FechaInicio) = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente}]
    )

    return (result.length === 0 ? null : {
      licencias: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC059: Constancia de cumplimiento de actividades
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc059(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        Año as año,
        Semestre as semestre,
        CASE 
          WHEN COUNT(*) = COUNT(CASE WHEN Asistencia = 'BUENA' THEN 1 END)
            THEN 'LIBERADO'
            ELSE 'NO LIBERADO'
        END AS estado
      FROM Asignatura_Docente
      WHERE ClaveDocente = @ClaveDocente
        AND Año = @Año
      GROUP BY 
        Año,
        Semestre
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      liberacionActividades: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC060: Carta de liberación de actividades
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc060(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        Año as año,
        CASE 
          WHEN COUNT(*) = COUNT(CASE WHEN Asistencia = 'BUENA' THEN 1 END)
            THEN 'LIBERADO'
            ELSE 'NO LIBERADO'
        END AS estado
      FROM Asignatura_Docente
      WHERE ClaveDocente = @ClaveDocente
        AND Año = @Año
      GROUP BY Año    
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      liberacionActividades: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC061: Evaluación departamental nivel licenciatura
   * @param claveDocente: string
   * @param año: number
   * @param semestre: string
   * @param claveDepartamento: string
   */
  async generateDoc061(claveDocente: string, año: number, semestre: string, claveDepartamento: string) {
    const query = `
      SELECT 
        Año AS año,
        Semestre AS semestre,
        Calificacion AS calificacion
      FROM EvaluacionDepartamental
      WHERE ClaveDocente = @ClaveDocente
        AND Año = @Año
        AND Semestre = @Semestre
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año},
       {name: 'Semestre', value: semestre}]
    )

    return (result.length === 0 ? null : {
      evaluaciones: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC062: Evaluación departamental nivel posgrado
   * @param claveDocente: string
   * @param año: number
   * @param semestre: string
   * @param claveDepartamento: string
   */
  async generateDoc062(claveDocente: string, año: number, semestre: string, claveDepartamento: string) {
    const query = `
      SELECT 
        Año AS año,
        Semestre AS semestre,
        Calificacion AS calificacion
      FROM EvaluacionDepartamental
      WHERE ClaveDocente = @ClaveDocente
        AND Año = @Año
        AND Semestre = @Semestre
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año},
       {name: 'Semestre', value: semestre}]
    )


    return (result.length === 0 ? null : {
      evaluaciones: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }

  /**
   * DOC063: Evaluación de desempeño docente
   * @param claveDocente: string
   * @param año: number
   * @param claveDepartamento: string
   */
  async generateDoc063(claveDocente: string, año: number, claveDepartamento: string) {
    const query = `
      SELECT 
        Año AS AS año,
        Semestre AS semestre,
        porcentajeEstudiantado AS porcentajeEstudiantado
      FROM EvaluacionDesempeño
      WHERE ClaveDocente = @ClaveDocente
        AND Año = @Año
    `

    const result = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      query,
      [{name: 'ClaveDocente', value: claveDocente},
       {name: 'Año', value: año}]
    )

    return (result.length === 0 ? null : {
      evaluaciones: result,
      titular: await this.getDepartmentHeadById(claveDepartamento)
    });
  }
}