import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MssqlService } from '@strongnguyen/nestjs-mssql';
import { DynamicDatabaseService } from '../database/dynamic-database.service';
import { ActivitiesService } from '../activities/activities.service';
import { Ticket, GeneralTicket } from './interfaces/tickets.interfaces';
import { FilesService } from 'src/files/files.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  
  constructor(
    private readonly mssql: MssqlService,
    private readonly dynamicDb: DynamicDatabaseService,
    private readonly activitiesService: ActivitiesService,
    private readonly filesService: FilesService,
    private readonly usersService: UsersService,
  ) {}

  async createTicketByUsuario(data: {
    motivo: string;
    claveDocumento: string;
    claveUsuario: string;
    }): Promise<Ticket> {
    try {
        const user = await this.usersService.findByClaveUsuario(data.claveUsuario);
        if (!user) {
        throw new NotFoundException(`Usuario con clave ${data.claveUsuario} no encontrado`);
        }

        if (!(user.docente?.claveDocente || user.departamento?.claveDepartamento)) {
        throw new NotFoundException(
            `Usuario con clave ${data.claveUsuario} no tiene un rol asignado`
        );
        }

        let claveDepartamento = await this.filesService.getDepartmentByDocumentId(data.claveDocumento);

        if (!claveDepartamento && user.docente?.claveDocente) {
        claveDepartamento = await this.filesService.getDepartmentByProfessorId(user.docente.claveDocente);
        }

        const ticketData = {
        motivo: data.motivo,
        claveProfesor: user.docente?.claveDocente || null,
        claveDepartamento: claveDepartamento,
        claveDocumento: data.claveDocumento,
        };

        return await this.createTicket(ticketData);
    } catch (error) {
        this.logger.error(`Error en createTicketByUsuario: ${error.message}`, error.stack);
        throw error;
    }
  }

  // Crear ticket individual (método original modificado)
  async createTicket(data: {
    motivo: string;
    claveProfesor: string;
    claveDepartamento: string;
    claveDocumento: string;
  }): Promise<Ticket> {
    try {
      this.logger.log('Creando ticket en la base de datos');
      const fechaCreacion = new Date();
      const timestamp = fechaCreacion.getTime();
      const clave = `${data.claveProfesor}-${timestamp}`;
      
      const pool = await this.mssql.getPool();
      await pool
        .request()
        .input('ClaveTicket', clave)
        .input('FechaCreacion', fechaCreacion)
        .input('Motivo', data.motivo)
        .input('ClaveDocente', data.claveProfesor)
        .input('ClaveDepartamento', data.claveDepartamento)
        .input('ClaveDocumento', data.claveDocumento)
        .input('Estado', 'PENDIENTE')
        .query(`
          INSERT INTO Ticket (ClaveTicket, FechaCreacion, Motivo, ClaveDocente, ClaveDepartamento, ClaveDocumento, Estado)
          VALUES (@ClaveTicket, @FechaCreacion, @Motivo, @ClaveDocente, @ClaveDepartamento, @ClaveDocumento, @Estado);
        `);
      
      const ticket = await this.getTicketShownData(clave);
      return ticket;
    } catch (error) {
      this.logger.error(`Error en createTicket: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Obtener tickets por claveUsuario
  async getTicketsByUsuario(claveUsuario: string) {
    try {
        const user = await this.usersService.findByClaveUsuario(claveUsuario);

        if (!user) {
        throw new NotFoundException(`Usuario con clave ${claveUsuario} no encontrado`);
        }

        const claveDocente = user.docente?.claveDocente;
        const claveDepartamento = user.departamento?.claveDepartamento;

        if (!claveDocente && !claveDepartamento) {
        throw new NotFoundException(
            `Usuario con clave ${claveUsuario} no tiene rol Docente ni Administrativo`
        );
        }

        const pool = await this.mssql.getPool();

        const condition = claveDocente
        ? `t.ClaveDocente = @ClaveDocente`
        : `t.ClaveDepartamento = @ClaveDepartamento`;

        const request = pool.request();

        if (claveDocente) {
        request.input('ClaveDocente', claveDocente);
        } else {
        request.input('ClaveDepartamento', claveDepartamento);
        }

        const result = await request.query(`
        SELECT 
            t.ClaveTicket,
            t.FechaCreacion,
            t.Motivo,
            t.Estado,
            t.Resolucion,
            d.Nombre as NombreDocumento,
            dep.Nombre as NombreDepartamento
        FROM Ticket t
        INNER JOIN Documento d ON t.ClaveDocumento = d.ClaveDocumento
        INNER JOIN Departamento dep ON t.ClaveDepartamento = dep.ClaveDepartamento
        WHERE ${condition}
        ORDER BY t.FechaCreacion DESC
        `);

        return result.recordset;

    } catch (error) {
        this.logger.error(
        `Error en getTicketsByUsuario: ${error.message}`,
        error.stack
        );
        throw error;
    }
  }

  // Obtener ticket por clave
  async getTicketByKey(claveTicket: string) {
    try {
      const pool = await this.mssql.getPool();
      const result = await pool
        .request()
        .input('ClaveTicket', claveTicket)
        .query(`
          SELECT 
            t.ClaveTicket,
            t.FechaCreacion,
            t.Motivo,
            t.Estado,
            t.Resolucion,
            t.ClaveDocente,
            t.ClaveDepartamento,
            t.ClaveDocumento,
            d.Nombre as NombreDocumento,
            dep.Nombre as NombreDepartamento,
            doc.Nombre + ' ' + doc.ApellidoPaterno + ' ' + doc.ApellidoMaterno as NombreDocente,
            a.Nombre as NombreActividad
          FROM Ticket t
          INNER JOIN Documento d ON t.ClaveDocumento = d.ClaveDocumento
          INNER JOIN Departamento dep ON t.ClaveDepartamento = dep.ClaveDepartamento
          INNER JOIN Docente doc ON t.ClaveDocente = doc.ClaveDocente
          LEFT JOIN Actividad_Documento ad ON t.ClaveDocumento = ad.ClaveDocumento
          LEFT JOIN Actividad a ON ad.ClaveActividad = a.ClaveActividad
          WHERE t.ClaveTicket = @ClaveTicket
        `);
      
      if (!result.recordset[0]) {
        throw new NotFoundException(`Ticket con clave ${claveTicket} no encontrado`);
      }
      
      return result.recordset[0];
    } catch (error) {
      this.logger.error(`Error en getTicketByKey: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getTicketShownData(claveTicket: string): Promise<Ticket> {
    const pool = await this.mssql.getPool();
    const data = await pool
      .request()
      .input('ClaveTicket', claveTicket)
      .query(`
        SELECT 
          d.Nombre as documento,      
          a.Nombre as actividad,
          t.Estado as estado,
          t.FechaCreacion as fechaCreacion,
          t.Resolucion as resolucion
        FROM Ticket t
        INNER JOIN Documento d ON t.ClaveDocumento = d.ClaveDocumento
        LEFT JOIN Actividad_Documento ad ON t.ClaveDocumento = ad.ClaveDocumento
        LEFT JOIN Actividad a ON ad.ClaveActividad = a.ClaveActividad
        WHERE ClaveTicket = @ClaveTicket;
      `);
      
    return {
      documento: data.recordset[0]?.documento,
      actividad: data.recordset[0]?.actividad,
      estado: data.recordset[0]?.estado,
      fechaCreacion: data.recordset[0]?.fechaCreacion,
      resolucion: data.recordset[0]?.resolucion,
    };
  }

  // === TICKETS GENERALES ===

  // Crear ticket general por claveUsuario
  async createGeneralTicketByUsuario(data: {
    motivo: string;
    claveUsuario: string;
  }): Promise<GeneralTicket> {
    try {
      const user = await this.usersService.findByClaveUsuario(data.claveUsuario);

      if (!user) {
        throw new NotFoundException(`Usuario con clave ${data.claveUsuario} no encontrado`);
      }

      if (!(user.docente?.claveDocente || user.departamento?.claveDepartamento)) {
        throw new NotFoundException(
            `Usuario con clave ${data.claveUsuario} no tiene un rol asignado`
        );
      }

      return await this.createGeneralTicket({
        motivo: data.motivo,
        claveProfesor: user.docente.claveDocente,
      });
    } catch (error) {
      this.logger.error(`Error en createGeneralTicketByUsuario: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getGeneralTicketsByUsuario(claveUsuario: string) {
  try {
    this.logger.log(`[GET_GENERAL_TICKETS] ====== INICIANDO BÚSQUEDA DE TICKETS GENERALES ======`);
    this.logger.log(`[GET_GENERAL_TICKETS] Clave Usuario: ${claveUsuario}`);

    // Obtener información del usuario
    this.logger.log(`[GET_GENERAL_TICKETS] Buscando información del usuario...`);
    const user = await this.usersService.findByClaveUsuario(claveUsuario);

    if (!user) {
      this.logger.error(`[GET_GENERAL_TICKETS] ❌ Usuario no encontrado: ${claveUsuario}`);
      throw new NotFoundException(`Usuario con clave ${claveUsuario} no encontrado`);
    }

    this.logger.log(`[GET_GENERAL_TICKETS] Usuario encontrado: ${user.correo}`);
    this.logger.log(`[GET_GENERAL_TICKETS] Tipo de usuario: ${user.tipoUsuario}`);

    const pool = await this.mssql.getPool();
    const request = pool.request();

    let query = `
      SELECT 
        tg.ClaveTicketGeneral,
        tg.Motivo,
        tg.Estado,
        tg.FechaCreacion,
        tg.ClaveDocente,
        doc.Nombre + ' ' + doc.ApellidoPaterno + ' ' + doc.ApellidoMaterno AS NombreDocente,
        (
          SELECT COUNT(DISTINCT ClaveDepartamento) 
          FROM TicketGeneral_Departamento 
          WHERE ClaveTicketGeneral = tg.ClaveTicketGeneral
        ) AS DepartamentosResueltos,
        (
          SELECT 
            dep.ClaveDepartamento,
            dep.Nombre AS Departamento,
            tgd2.Resolucion
          FROM TicketGeneral_Departamento tgd2
          INNER JOIN Departamento dep 
            ON tgd2.ClaveDepartamento = dep.ClaveDepartamento
          WHERE tgd2.ClaveTicketGeneral = tg.ClaveTicketGeneral
          FOR JSON PATH
        ) AS Respuestas
      FROM TicketGeneral tg
      INNER JOIN Docente doc
        ON tg.ClaveDocente = doc.ClaveDocente
    `;

    // Determinar filtros según tipo de usuario
    if (user.tipoUsuario === 'DOCENTE') {
      const claveDocente = user.docente?.claveDocente;
      
      if (!claveDocente) {
        this.logger.error(`[GET_GENERAL_TICKETS] ❌ Usuario DOCENTE sin ClaveDocente`);
        throw new NotFoundException(`Docente no encontrado para usuario ${claveUsuario}`);
      }

      this.logger.log(`[GET_GENERAL_TICKETS] 👨‍🏫 FILTRO DOCENTE aplicado`);
      this.logger.log(`[GET_GENERAL_TICKETS] ClaveDocente: ${claveDocente}`);
      this.logger.log(`[GET_GENERAL_TICKETS] Lógica: Solo tickets creados por este docente`);

      request.input('ClaveDocente', claveDocente);

      query += `
        WHERE tg.ClaveDocente = @ClaveDocente
      `;

    } else if (user.tipoUsuario === 'ADMINISTRATIVO') {
      const claveDepartamento = user.departamento?.claveDepartamento;

      if (!claveDepartamento) {
        this.logger.error(`[GET_GENERAL_TICKETS] ❌ Usuario ADMINISTRATIVO sin ClaveDepartamento`);
        throw new NotFoundException(`Departamento no encontrado para usuario ${claveUsuario}`);
      }

      this.logger.log(`[GET_GENERAL_TICKETS] 🏢 FILTRO DEPARTAMENTO aplicado`);
      this.logger.log(`[GET_GENERAL_TICKETS] ClaveDepartamento: ${claveDepartamento}`);
      this.logger.log(`[GET_GENERAL_TICKETS] Departamento: ${user.departamento.nombre}`);
      this.logger.log(`[GET_GENERAL_TICKETS] Lógica: TODOS los tickets generales (para poder responder)`);

      // No agregamos WHERE - todos los departamentos ven todos los tickets generales
      this.logger.log(`[GET_GENERAL_TICKETS] ✅ Sin filtro WHERE - mostrando todos los tickets generales`);

    } else {
      this.logger.error(`[GET_GENERAL_TICKETS] ❌ Tipo de usuario no reconocido: ${user.tipoUsuario}`);
      throw new NotFoundException(`Tipo de usuario no válido: ${user.tipoUsuario}`);
    }

    query += `
      ORDER BY tg.FechaCreacion DESC;
    `;

    this.logger.log(`[GET_GENERAL_TICKETS] Ejecutando query SQL...`);
    this.logger.log(`[GET_GENERAL_TICKETS] Query: ${query.substring(0, 200)}...`);
    
    const result = await request.query(query);

    this.logger.log(`[GET_GENERAL_TICKETS] Query ejecutada exitosamente`);
    this.logger.log(`[GET_GENERAL_TICKETS] Tickets encontrados: ${result.recordset.length}`);

    if (result.recordset.length === 0) {
      this.logger.log(`[GET_GENERAL_TICKETS] ⚠️ No se encontraron tickets generales`);
    }

    // Procesar resultados y agregar información del departamento actual
    const claveDepartamentoActual = user.tipoUsuario === 'ADMINISTRATIVO' 
      ? user.departamento?.claveDepartamento 
      : null;

    const processedResults = result.recordset.map((item, index) => {
      const respuestas = JSON.parse(item.Respuestas ?? '[]');
      
      // Verificar si el departamento actual ya respondió
      const departamentoYaRespondio = claveDepartamentoActual 
        ? respuestas.some((r: any) => r.ClaveDepartamento === claveDepartamentoActual)
        : false;

      // Encontrar la respuesta del departamento actual si existe
      const respuestaDepartamentoActual = claveDepartamentoActual
        ? respuestas.find((r: any) => r.ClaveDepartamento === claveDepartamentoActual)
        : null;

      this.logger.log(`[GET_GENERAL_TICKETS] Ticket ${index + 1}/${result.recordset.length}:`);
      this.logger.log(`[GET_GENERAL_TICKETS]   - Clave: ${item.ClaveTicketGeneral}`);
      this.logger.log(`[GET_GENERAL_TICKETS]   - Estado: ${item.Estado}`);
      this.logger.log(`[GET_GENERAL_TICKETS]   - Docente: ${item.NombreDocente}`);
      this.logger.log(`[GET_GENERAL_TICKETS]   - Departamentos que respondieron: ${item.DepartamentosResueltos}`);
      this.logger.log(`[GET_GENERAL_TICKETS]   - Total respuestas: ${respuestas.length}`);
      
      if (claveDepartamentoActual) {
        this.logger.log(`[GET_GENERAL_TICKETS]   - Departamento actual ya respondió: ${departamentoYaRespondio ? 'SÍ' : 'NO'}`);
        if (respuestaDepartamentoActual) {
          this.logger.log(`[GET_GENERAL_TICKETS]   - Respuesta del departamento: "${respuestaDepartamentoActual.Resolucion?.substring(0, 50)}..."`);
        }
      }
      
      if (respuestas.length > 0) {
        respuestas.forEach((resp: any, i: number) => {
          this.logger.log(`[GET_GENERAL_TICKETS]     Respuesta ${i + 1}: ${resp.Departamento} - ${resp.Resolucion ? 'Resuelta' : 'Sin resolución'}`);
        });
      }

      return {
        ...item,
        Respuestas: respuestas,
        // Información adicional para el frontend
        DepartamentoActualRespondio: departamentoYaRespondio,
        RespuestaDepartamentoActual: respuestaDepartamentoActual?.Resolucion || null
      };
    });

    this.logger.log(`[GET_GENERAL_TICKETS] ====== BÚSQUEDA COMPLETADA EXITOSAMENTE ======`);
    this.logger.log(`[GET_GENERAL_TICKETS] Resumen:`);
    this.logger.log(`[GET_GENERAL_TICKETS]   - Total tickets: ${processedResults.length}`);
    this.logger.log(`[GET_GENERAL_TICKETS]   - Usuario: ${user.tipoUsuario}`);
    
    if (user.tipoUsuario === 'DOCENTE') {
      this.logger.log(`[GET_GENERAL_TICKETS]   - Filtro: Tickets propios del docente ${user.docente?.claveDocente}`);
    } else {
      this.logger.log(`[GET_GENERAL_TICKETS]   - Filtro: TODOS los tickets generales (departamento puede responder a todos)`);
      
      // Contar tickets pendientes de respuesta por este departamento
      const ticketsPendientes = processedResults.filter(
        (t: any) => !t.DepartamentoActualRespondio
      ).length;
      const ticketsRespondidos = processedResults.filter(
        (t: any) => t.DepartamentoActualRespondio
      ).length;
      
      this.logger.log(`[GET_GENERAL_TICKETS]   - Tickets pendientes de respuesta: ${ticketsPendientes}`);
      this.logger.log(`[GET_GENERAL_TICKETS]   - Tickets ya respondidos por este departamento: ${ticketsRespondidos}`);
    }

    return processedResults;

  } catch (error) {
    this.logger.error(`[GET_GENERAL_TICKETS] ❌ ERROR en búsqueda de tickets generales`);
    this.logger.error(`[GET_GENERAL_TICKETS] Clave Usuario: ${claveUsuario}`);
    this.logger.error(`[GET_GENERAL_TICKETS] Error: ${error.message}`);
    this.logger.error(`[GET_GENERAL_TICKETS] Stack trace:`, error.stack);
    throw error;
  }
}

  async getTicket(claveTicketGeneral: string): Promise<GeneralTicket> {
    try {
        this.logger.log(`Buscando tickets con ClaveTicketGeneral: ${claveTicketGeneral}`);
        
        const pool = await this.mssql.getPool();
        const data = await pool
        .request()
        .input('ClaveTicketGeneral', claveTicketGeneral)
        .query(`
            SELECT 
            Motivo as motivo,
            Estado as estado,
            FechaCreacion as fechaCreacion
            FROM TicketGeneral
            WHERE ClaveTicketGeneral = @ClaveTicketGeneral;
        `);
        
        // Verificar si se encontró el ticket
        if (!data.recordset[0]) {
            this.logger.warn(`Ticket general no encontrado: ${claveTicketGeneral}`);
            throw new NotFoundException(`Ticket general con clave ${claveTicketGeneral} no encontrado`);
        }
        
        this.logger.log(`Ticket encontrado, obteniendo resoluciones...`);
        const resolutions = await this.getGeneralTicketResolutions(claveTicketGeneral);
        
        return {
            motivo: data.recordset[0].motivo,
            estado: data.recordset[0].estado,
            fechaCreacion: data.recordset[0].fechaCreacion,
            resoluciones: resolutions,
        }
    } catch (error) {
        this.logger.error(`Error en getTicket: ${error.message}`, error.stack);
        throw error;
    }
  }

  async updateTicket(claveTicket: string, resolucion: string): Promise<Ticket> {
    try {
      this.logger.log(`Actualizando resolución del ticket: ${claveTicket}`);
      
      const pool = await this.mssql.getPool();
      await pool
        .request()
        .input('ClaveTicket', claveTicket)
        .input('Resolucion', resolucion)
        .input('Estado', 'RESUELTO')
        .query(`
          UPDATE Ticket
          SET Resolucion = @Resolucion,
              Estado = @Estado
          WHERE ClaveTicket = @ClaveTicket;
        `);
        
      const ticket = await this.getTicketShownData(claveTicket);
      return ticket;
    } catch (error) {
      this.logger.error(`Error en updateTicket: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createGeneralTicket(data: {
    motivo: string;
    claveProfesor: string;
  }): Promise<GeneralTicket> {
    try {
      this.logger.log('Creando ticket general en la base de datos');
      
      const fechaCreacion = new Date();
      const timestamp = fechaCreacion.getTime();
      const clave = `${data.claveProfesor}-${timestamp}`;
      
      const pool = await this.mssql.getPool();
      await pool
        .request()
        .input('ClaveTicketGeneral', clave)
        .input('FechaCreacion', fechaCreacion)
        .input('Motivo', data.motivo)
        .input('Estado', 'PENDIENTE')
        .input('ClaveDocente', data.claveProfesor)
        .query(`
          INSERT INTO TicketGeneral (ClaveTicketGeneral, FechaCreacion, Motivo, Estado, ClaveDocente)
          VALUES (@ClaveTicketGeneral, @FechaCreacion, @Motivo, @Estado, @ClaveDocente);
        `);
        
      const ticketGeneral = await this.getTicket(clave);
      return ticketGeneral;
    } catch (error) {
      this.logger.error(`Error en createGeneralTicket: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getGeneralTicketResolutions(claveTicketGeneral: string): Promise<string[] | null> {
    try {
        this.logger.log(`Buscando resoluciones del ticket general: ${claveTicketGeneral}`);
        
        const pool = await this.mssql.getPool();
        const resolutions = await pool
        .request()
        .input('ClaveTicketGeneral', claveTicketGeneral)
        .query(`
            SELECT
            tgd.Resolucion as resolucion,
            d.Nombre as departamento
            FROM TicketGeneral_Departamento tgd
            INNER JOIN Departamento d ON tgd.ClaveDepartamento = d.ClaveDepartamento
            WHERE tgd.ClaveTicketGeneral = @ClaveTicketGeneral;
        `);
        
        if (!resolutions.recordset || resolutions.recordset.length === 0) {
            this.logger.log(`No se encontraron resoluciones para el ticket: ${claveTicketGeneral}`);
            return [];
        }
        
        const formattedResolutions = resolutions.recordset.map(r => `${r.departamento}: ${r.resolucion}`);
        this.logger.log(`Resoluciones encontradas: ${formattedResolutions.length}`);
        
        return formattedResolutions;
    } catch (error) {
        this.logger.error(`Error en getGeneralTicketResolutions: ${error.message}`, error.stack);
        throw error;
    }
  }

  async updateGeneralTicket(
    claveTicketGeneral: string,
    resolucion: string,
    claveDepartamento: string
    ): Promise<GeneralTicket> {

    try {
        this.logger.log(`Actualizando TG: ${claveTicketGeneral} para DEP: ${claveDepartamento}`);
        const pool = await this.mssql.getPool();
        const request = pool.request();

        // Verificar si ya existe la resolución
        const existing = await request
        .input('ClaveTicketGeneral', claveTicketGeneral)
        .input('ClaveDepartamento', claveDepartamento)
        .query(`
            SELECT 1
            FROM TicketGeneral_Departamento 
            WHERE ClaveTicketGeneral = @ClaveTicketGeneral 
            AND ClaveDepartamento = @ClaveDepartamento
        `);

        if (existing.recordset.length > 0) {
          await request
            .input('Resolucion', resolucion)
            .query(`
            UPDATE TicketGeneral_Departamento 
            SET Resolucion = @Resolucion
            WHERE ClaveTicketGeneral = @ClaveTicketGeneral 
                AND ClaveDepartamento = @ClaveDepartamento
            `);

        } else {
          await request
            .input('Resolucion', resolucion)
            .query(`
            INSERT INTO TicketGeneral_Departamento 
            (ClaveTicketGeneral, ClaveDepartamento, Resolucion)
            VALUES (@ClaveTicketGeneral, @ClaveDepartamento, @Resolucion)
            `);
        }

        // Verificar resoluciones totales
        const allDepartments = await pool.request().query(`SELECT COUNT(*) as total FROM Departamento`);
        const resolvedDepartments = await pool
        .request()
        .input('ClaveTicketGeneral', claveTicketGeneral)
        .query(`
            SELECT COUNT(*) as resueltos 
            FROM TicketGeneral_Departamento 
            WHERE ClaveTicketGeneral = @ClaveTicketGeneral
        `);

        if (resolvedDepartments.recordset[0].resueltos >= (allDepartments.recordset[0].total - 1)) {
          await pool.request()
            .input('ClaveTicketGeneral', claveTicketGeneral)
            .query(`
            UPDATE TicketGeneral 
            SET Estado = 'RESUELTO' 
            WHERE ClaveTicketGeneral = @ClaveTicketGeneral
            `);
        }

        return this.getTicket(claveTicketGeneral);
    } catch (error) {
        this.logger.error(`Error en updateGeneralTicket: ${error.message}`, error.stack);
        throw error;
    }
  }
}