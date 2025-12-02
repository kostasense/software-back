import { Injectable } from '@nestjs/common';
import { MssqlService } from '@strongnguyen/nestjs-mssql';
import { DynamicDatabaseService } from '../database/dynamic-database.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

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
        .query(`
        SELECT 
            u.ClaveUsuario,
            u.Correo,
            u.Contrasena,
            u.Rol,
            u.ClaveDepartamento,
            u.ClaveDocente,
            -- Datos del Docente (si aplica)
            d.Nombre AS DocenteNombre,
            d.ApellidoPaterno AS DocenteApellidoPaterno,
            d.ApellidoMaterno AS DocenteApellidoMaterno,
            d.ClaveDepartamento AS DocenteDepartamento,
            -- Datos del Departamento del Docente
            dd.Nombre AS DocenteDepartamentoNombre,
            -- Datos del Departamento (si el usuario es administrativo)
            dep.Nombre AS DepartamentoNombre,
            dep.TitularNombre AS DepartamentoTitularNombre,
            dep.TitularApellidoPaterno AS DepartamentoTitularApellidoPaterno,
            dep.TitularApellidoMaterno AS DepartamentoTitularApellidoMaterno,
            dep.Correo AS DepartamentoCorreo,
            dep.URL AS DepartamentoURL
        FROM Usuario u
        LEFT JOIN Docente d ON u.ClaveDocente = d.ClaveDocente
        LEFT JOIN Departamento dd ON d.ClaveDepartamento = dd.ClaveDepartamento
        LEFT JOIN Departamento dep ON u.ClaveDepartamento = dep.ClaveDepartamento
        WHERE u.ClaveUsuario = @ClaveUsuario
        `);
    
    if (!result.recordset[0]) {
        return null;
    }
    
    const user = result.recordset[0];
    
    // Construir objeto de respuesta con información completa
    const userInfo: any = {
        claveUsuario: user.ClaveUsuario,
        correo: user.Correo,
        rol: user.Rol,
    };
    
    // Si es docente, agregar información del docente
    if (user.ClaveDocente) {
        userInfo.tipoUsuario = 'DOCENTE';
        userInfo.docente = {
        claveDocente: user.ClaveDocente,
        nombre: user.DocenteNombre,
        apellidoPaterno: user.DocenteApellidoPaterno,
        apellidoMaterno: user.DocenteApellidoMaterno,
        nombreCompleto: `${user.DocenteNombre} ${user.DocenteApellidoPaterno} ${user.DocenteApellidoMaterno}`.trim(),
        departamento: {
            claveDepartamento: user.DocenteDepartamento,
            nombre: user.DocenteDepartamentoNombre
        }
        };
    }
    
    // Si es administrativo, agregar información del departamento
    if (user.ClaveDepartamento) {
        userInfo.tipoUsuario = 'ADMINISTRATIVO';
        userInfo.departamento = {
        claveDepartamento: user.ClaveDepartamento,
        nombre: user.DepartamentoNombre,
        titular: {
            nombre: user.DepartamentoTitularNombre,
            apellidoPaterno: user.DepartamentoTitularApellidoPaterno,
            apellidoMaterno: user.DepartamentoTitularApellidoMaterno,
            nombreCompleto: `${user.DepartamentoTitularNombre} ${user.DepartamentoTitularApellidoPaterno} ${user.DepartamentoTitularApellidoMaterno}`.trim()
        },
        correo: user.DepartamentoCorreo,
        url: user.DepartamentoURL
        };
    }
    
    return userInfo;
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

  async changePassword(
    claveUsuario: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
        const pool = this.mssql.getPool();

        const result = await pool
        .request()
        .input('ClaveUsuario', claveUsuario)
        .query(`
            SELECT Contrasena 
            FROM Usuario
            WHERE ClaveUsuario = @ClaveUsuario
        `);

        const dbPassword = result.recordset[0]?.Contrasena;

        if (!dbPassword) {
        return { success: false, message: 'Usuario no encontrado' };
        }

        const isMatch = await bcrypt.compare(oldPassword, dbPassword);

        if (!isMatch) {
        return { success: false, message: 'La contraseña actual es incorrecta' };
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool
        .request()
        .input('ClaveUsuario', claveUsuario)
        .input('NuevaContrasena', hashedPassword)
        .query(`
            UPDATE Usuario 
            SET Contrasena = @NuevaContrasena
            WHERE ClaveUsuario = @ClaveUsuario
        `);

        return { success: true, message: 'Contraseña modificada con éxito' };

    } catch (error) {
        console.error(error);
        throw new Error('Error al cambiar la contraseña');
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