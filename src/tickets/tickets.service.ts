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

  // Crear ticket por claveUsuario
  async createTicketByUsuario(data: {
    motivo: string;
    claveDocumento: string;
    claveUsuario: string;
  }): Promise<Ticket> {
    try {
      // Obtener datos del usuario y docente
      const user = await this.usersService.findByClaveUsuario(data.claveUsuario);
      if (!user || !user.ClaveDocente) {
        throw new NotFoundException(`Usuario/Docente con clave ${data.claveUsuario} no encontrado`);
      }

      const claveDepartamento = await this.filesService.getDepartmentByProfessorId(user.ClaveDocente);
      
      const ticketData = {
        motivo: data.motivo,
        claveProfesor: user.ClaveDocente,
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
      if (!user || !user.ClaveDocente) {
        throw new NotFoundException(`Usuario/Docente con clave ${claveUsuario} no encontrado`);
      }

      const pool = await this.mssql.getPool();
      const result = await pool
        .request()
        .input('ClaveDocente', user.ClaveDocente)
        .query(`
          SELECT 
            t.ClaveTicket,
            t.FechaCreacion,
            t.Motivo,
            t.Estado,
            t.Resolucion,
            d.Nombre as NombreDocumento,
            dep.Nombre as NombreDepartamento,
            a.Nombre as NombreActividad
          FROM Ticket t
          INNER JOIN Documento d ON t.ClaveDocumento = d.ClaveDocumento
          INNER JOIN Departamento dep ON t.ClaveDepartamento = dep.ClaveDepartamento
          LEFT JOIN Actividad_Documento ad ON t.ClaveDocumento = ad.ClaveDocumento
          LEFT JOIN Actividad a ON ad.ClaveActividad = a.ClaveActividad
          WHERE t.ClaveDocente = @ClaveDocente
          ORDER BY t.FechaCreacion DESC
        `);
      
      return result.recordset;
    } catch (error) {
      this.logger.error(`Error en getTicketsByUsuario: ${error.message}`, error.stack);
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
      if (!user || !user.ClaveDocente) {
        throw new NotFoundException(`Usuario/Docente con clave ${data.claveUsuario} no encontrado`);
      }

      return await this.createGeneralTicket({
        motivo: data.motivo,
        claveProfesor: user.ClaveDocente,
      });
    } catch (error) {
      this.logger.error(`Error en createGeneralTicketByUsuario: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Obtener tickets generales por usuario
  async getGeneralTicketsByUsuario(claveUsuario: string) {
    try {
      const user = await this.usersService.findByClaveUsuario(claveUsuario);
      if (!user || !user.ClaveDocente) {
        throw new NotFoundException(`Usuario/Docente con clave ${claveUsuario} no encontrado`);
      }

      const pool = await this.mssql.getPool();
      const result = await pool
        .request()
        .input('ClaveDocente', user.ClaveDocente)
        .query(`
          SELECT 
            tg.ClaveTicketGeneral,
            tg.Motivo,
            tg.Estado,
            tg.FechaCreacion,
            doc.Nombre + ' ' + doc.ApellidoPaterno + ' ' + doc.ApellidoMaterno as NombreDocente,
            COUNT(DISTINCT tgd.ClaveDepartamento) as DepartamentosResueltos
          FROM TicketGeneral tg
          INNER JOIN Docente doc ON tg.ClaveDocente = doc.ClaveDocente
          LEFT JOIN TicketGeneral_Departamento tgd ON tg.ClaveTicketGeneral = tgd.ClaveTicketGeneral
          WHERE tg.ClaveDocente = @ClaveDocente
          GROUP BY tg.ClaveTicketGeneral, tg.Motivo, tg.Estado, tg.FechaCreacion,
                   doc.Nombre, doc.ApellidoPaterno, doc.ApellidoMaterno
          ORDER BY tg.FechaCreacion DESC
        `);
      
      return result.recordset;
    } catch (error) {
      this.logger.error(`Error en getGeneralTicketsByUsuario: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Métodos existentes sin cambios
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
        
      const resolutions = await this.getGeneralTicketResolutions(claveTicketGeneral);
      
      return {
        motivo: data.recordset[0]?.motivo,
        estado: data.recordset[0]?.estado,
        fechaCreacion: data.recordset[0]?.fechaCreacion,
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
        
      return resolutions.recordset.map(r => `${r.departamento}: ${r.resolucion}`) || null;
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
      this.logger.log(`Actualizando ticket general: ${claveTicketGeneral} para departamento: ${claveDepartamento}`);
      
      const pool = await this.mssql.getPool();
      
      // Verificar si ya existe una resolución para este departamento
      const existing = await pool
        .request()
        .input('ClaveTicketGeneral', claveTicketGeneral)
        .input('ClaveDepartamento', claveDepartamento)
        .query(`
          SELECT * FROM TicketGeneral_Departamento 
          WHERE ClaveTicketGeneral = @ClaveTicketGeneral 
            AND ClaveDepartamento = @ClaveDepartamento
        `);
      
      if (existing.recordset.length > 0) {
        // Actualizar resolución existente
        await pool
          .request()
          .input('ClaveTicketGeneral', claveTicketGeneral)
          .input('ClaveDepartamento', claveDepartamento)
          .input('Resolucion', resolucion)
          .query(`
            UPDATE TicketGeneral_Departamento 
            SET Resolucion = @Resolucion
            WHERE ClaveTicketGeneral = @ClaveTicketGeneral 
              AND ClaveDepartamento = @ClaveDepartamento
          `);
      } else {
        // Insertar nueva resolución
        await pool
          .request()
          .input('ClaveTicketGeneral', claveTicketGeneral)
          .input('ClaveDepartamento', claveDepartamento)
          .input('Resolucion', resolucion)
          .query(`
            INSERT INTO TicketGeneral_Departamento (ClaveTicketGeneral, ClaveDepartamento, Resolucion)
            VALUES (@ClaveTicketGeneral, @ClaveDepartamento, @Resolucion);
          `);
      }
      
      // Verificar si todas las resoluciones están completas para actualizar el estado
      const allDepartments = await pool
        .request()
        .query(`SELECT COUNT(*) as total FROM Departamento`);
      
      const resolvedDepartments = await pool
        .request()
        .input('ClaveTicketGeneral', claveTicketGeneral)
        .query(`
          SELECT COUNT(*) as resueltos 
          FROM TicketGeneral_Departamento 
          WHERE ClaveTicketGeneral = @ClaveTicketGeneral
        `);
      
      // Si todos los departamentos han resuelto, actualizar estado a RESUELTO
      if (resolvedDepartments.recordset[0].resueltos >= allDepartments.recordset[0].total) {
        await pool
          .request()
          .input('ClaveTicketGeneral', claveTicketGeneral)
          .query(`
            UPDATE TicketGeneral 
            SET Estado = 'RESUELTO' 
            WHERE ClaveTicketGeneral = @ClaveTicketGeneral
          `);
      }
      
      const ticketGeneral = await this.getTicket(claveTicketGeneral);
      return ticketGeneral;
    } catch (error) {
      this.logger.error(`Error en updateGeneralTicket: ${error.message}`, error.stack);
      throw error;
    }
  }
}