import { Injectable } from '@nestjs/common';
import { MssqlService } from '@strongnguyen/nestjs-mssql';
import { DynamicDatabaseService } from '../database/dynamic-database.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly mssql: MssqlService,
    private readonly dynamicDb: DynamicDatabaseService,
  ) {}

  // ========== MÉTODOS PARA BASE DE DATOS PRINCIPAL ==========
  
  async findByEmail(email: string) {
    const pool = this.mssql.getPool();
    const result = await pool
      .request()
      .input('Correo', email)
      .query(`SELECT * FROM Usuario WHERE Correo = @Correo`);
    
    return result.recordset[0] || null;
  }

  async findByClaveUsuario(claveUsuario: string) {
    const pool = this.mssql.getPool();
    const result = await pool
      .request()
      .input('ClaveUsuario', claveUsuario)
      .query(`SELECT * FROM Usuario WHERE ClaveUsuario = @ClaveUsuario`);
    
    return result.recordset[0] || null;
  }

  async updateUser(claveUsuario: string, dto: UpdateUserDto) {
    const pool = this.mssql.getPool();
    const keys = Object.keys(dto);
    
    if (keys.length === 0) {
      return this.findByClaveUsuario(claveUsuario);
    }

    const setSql = keys.map((k) => `${k} = @${k}`).join(', ');
    const request = pool.request();
    
    keys.forEach((k) => {
      request.input(k, dto[k]);
    });

    await request
      .input('ClaveUsuario', claveUsuario)
      .query(`UPDATE Usuario SET ${setSql} WHERE ClaveUsuario = @ClaveUsuario`);
    
    return this.findByClaveUsuario(claveUsuario);
  }
  
  async getAll() {
    const pool = this.mssql.getPool();
    const result = await pool.request().query(`SELECT * FROM Usuario`);
    
    return result.recordset;
  }

  async changePassword(claveUsuario: string, oldPassword: string, newPassword: string): Promise<boolean> {
    try {
        const pool = this.mssql.getPool();
        
        // Verificar contraseña actual
        const user = await pool
        .request()
        .input('ClaveUsuario', claveUsuario)
        .input('Contrasena', oldPassword)
        .query(`
            SELECT ClaveUsuario 
            FROM Usuario 
            WHERE ClaveUsuario = @ClaveUsuario 
            AND Contrasena = @Contrasena
        `);
        
        if (!user.recordset[0]) {
        return false; // Contraseña actual incorrecta
        }
        
        // Actualizar contraseña
        await pool
        .request()
        .input('ClaveUsuario', claveUsuario)
        .input('NuevaContrasena', newPassword)
        .query(`
            UPDATE Usuario 
            SET Contrasena = @NuevaContrasena 
            WHERE ClaveUsuario = @ClaveUsuario
        `);
        
        return true;
    } catch (error) {
        throw error;
    }
  }

  // ========== EJEMPLOS DE MÉTODOS PARA MÚLTIPLES BASES DE DATOS ==========

  // Buscar por email en una base de datos específica
  async findByEmailInDepartment(email: string, claveDepartamento: string) {
    const results = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      `SELECT * FROM Usuario WHERE Correo = @Correo`,
      [{ name: 'Correo', value: email }]
    );
    
    return results[0] || null;
  }

  // Buscar por ClaveUsuario en un departamento específico
  async findByClaveUsuarioInDepartment(claveUsuario: string, claveDepartamento: string) {
    const results = await this.dynamicDb.executeQueryByDepartmentId(
      claveDepartamento,
      `SELECT * FROM Usuario WHERE ClaveUsuario = @ClaveUsuario`,
      [{ name: 'ClaveUsuario', value: claveUsuario }]
    );
    
    return results[0] || null;
  }

  // Obtener usuarios de todas las bases de datos configuradas
  async getAllUsersFromAllDepartments() {
    const departments = await this.dynamicDb.getDepartmentConnections();
    const allUsers = [] as any;

    for (const dept of departments) {
      try {
        const users = await this.dynamicDb.executeQueryByDepartmentId(
          dept.claveDepartamento,
          'SELECT * FROM Usuario'
        );
        
        allUsers.push({
          departamento: dept.nombre,
          claveDepartamento: dept.claveDepartamento,
          usuarios: users,
        });
      } catch (error) {
        console.error(`Error getting users from department ${dept.nombre}:`, error);
        allUsers.push({
          departamento: dept.nombre,
          claveDepartamento: dept.claveDepartamento,
          usuarios: [],
          error: error.message
        });
      }
    }

    return allUsers;
  }
}