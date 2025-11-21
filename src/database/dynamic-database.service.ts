import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { MssqlService } from '@strongnguyen/nestjs-mssql';
import * as sql from 'mssql';

interface DepartmentConnection {
  claveDepartamento: string;
  nombre: string;
  url: string;
  correo?: string;
}

interface ParsedConnectionUrl {
  server: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

@Injectable()
export class DynamicDatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DynamicDatabaseService.name);
  private connections: Map<string, sql.ConnectionPool> = new Map();
  
  constructor(private readonly mssql: MssqlService) {}

  async onModuleDestroy() {
    // Cerrar todas las conexiones al destruir el módulo
    for (const [key, pool] of this.connections) {
      try {
        await pool.close();
        this.logger.log(`Closed connection: ${key}`);
      } catch (error) {
        this.logger.error(`Error closing connection ${key}:`, error);
      }
    }
  }

  // Parsear URL de conexión
  private parseConnectionUrl(connectionUrl: string): ParsedConnectionUrl {
    try {
      const url = new URL(connectionUrl);
      
      return {
        server: url.hostname,
        port: parseInt(url.port) || 1433,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
      };
    } catch (error) {
      throw new Error(`Invalid connection URL: ${connectionUrl}`);
    }
  }

  // Obtener todas las configuraciones de departamentos con URL
  async getDepartmentConnections(): Promise<DepartmentConnection[]> {
    const pool = this.mssql.getPool();
    const result = await pool
      .request()
      .query(`
        SELECT 
          ClaveDepartamento as claveDepartamento,
          Nombre as nombre,
          URL as url,
          Correo as correo
        FROM Departamentos
        WHERE URL IS NOT NULL AND URL != ''
      `);
    
    return result.recordset;
  }

  // Obtener configuración de un departamento específico por ClaveDepartamento
  async getDepartmentConnectionById(claveDepartamento: string): Promise<DepartmentConnection | null> {
    const pool = this.mssql.getPool();
    const result = await pool
      .request()
      .input('ClaveDepartamento', claveDepartamento)
      .query(`
        SELECT 
          ClaveDepartamento as claveDepartamento,
          Nombre as nombre,
          URL as url,
          Correo as correo
        FROM Departamentos
        WHERE ClaveDepartamento = @ClaveDepartamento 
          AND URL IS NOT NULL AND URL != ''
      `);
    
    return result.recordset[0] || null;
  }

  // Obtener configuración de un departamento específico por nombre
  async getDepartmentConnectionByName(nombre: string): Promise<DepartmentConnection | null> {
    const pool = this.mssql.getPool();
    const result = await pool
      .request()
      .input('Nombre', nombre)
      .query(`
        SELECT 
          ClaveDepartamento as claveDepartamento,
          Nombre as nombre,
          URL as url,
          Correo as correo
        FROM Departamentos
        WHERE Nombre = @Nombre 
          AND URL IS NOT NULL AND URL != ''
      `);
    
    return result.recordset[0] || null;
  }

  // Crear o obtener una conexión por ClaveDepartamento
  async getConnectionByDepartmentId(claveDepartamento: string): Promise<sql.ConnectionPool> {
    const connectionKey = `dept_${claveDepartamento}`;
    
    // Si ya existe la conexión, verificar si está activa
    if (this.connections.has(connectionKey)) {
      const pool = this.connections.get(connectionKey)!;
      if (pool.connected) {
        return pool;
      }
      // Si no está conectada, eliminarla del mapa
      this.connections.delete(connectionKey);
    }

    // Obtener la configuración del departamento
    const config = await this.getDepartmentConnectionById(claveDepartamento);
    
    if (!config) {
      throw new Error(`Department ${claveDepartamento} not found or has no URL configured`);
    }

    // Crear nueva conexión
    const pool = await this.createConnection(config);
    this.connections.set(connectionKey, pool);
    this.logger.log(`Created new connection for department: ${config.nombre} (${claveDepartamento})`);
    
    return pool;
  }

  // Crear o obtener una conexión por nombre de departamento
  async getConnectionByDepartmentName(nombreDepartamento: string): Promise<sql.ConnectionPool> {
    const config = await this.getDepartmentConnectionByName(nombreDepartamento);
    
    if (!config) {
      throw new Error(`Department '${nombreDepartamento}' not found or has no URL configured`);
    }

    return this.getConnectionByDepartmentId(config.claveDepartamento);
  }

  // Crear una nueva conexión
  private async createConnection(config: DepartmentConnection): Promise<sql.ConnectionPool> {
    const parsedUrl = this.parseConnectionUrl(config.url);
    
    const poolConfig: sql.config = {
      server: parsedUrl.server,
      port: parsedUrl.port,
      user: parsedUrl.user,
      password: parsedUrl.password,
      database: parsedUrl.database,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      pool: {
        max: 10,
        min: 1,
        idleTimeoutMillis: 30000,
      },
    };

    const pool = new sql.ConnectionPool(poolConfig);
    await pool.connect();
    
    return pool;
  }

  // Ejecutar query en la base de datos de un departamento específico (por ID)
  async executeQueryByDepartmentId<T = any>(
    claveDepartamento: string,
    query: string,
    inputs?: { name: string; value: any }[]
  ): Promise<T[]> {
    const pool = await this.getConnectionByDepartmentId(claveDepartamento);
    const request = pool.request();
    
    // Agregar inputs si existen
    if (inputs) {
      inputs.forEach(input => {
        request.input(input.name, input.value);
      });
    }
    
    const result = await request.query(query);
    return result.recordset;
  }

  // Ejecutar query en la base de datos de un departamento específico (por nombre)
  async executeQueryByDepartmentName<T = any>(
    nombreDepartamento: string,
    query: string,
    inputs?: { name: string; value: any }[]
  ): Promise<T[]> {
    const pool = await this.getConnectionByDepartmentName(nombreDepartamento);
    const request = pool.request();
    
    // Agregar inputs si existen
    if (inputs) {
      inputs.forEach(input => {
        request.input(input.name, input.value);
      });
    }
    
    const result = await request.query(query);
    return result.recordset;
  }

  // Cerrar conexión de un departamento específico
  async closeDepartmentConnection(claveDepartamento: string): Promise<void> {
    const connectionKey = `dept_${claveDepartamento}`;
    
    if (this.connections.has(connectionKey)) {
      const pool = this.connections.get(connectionKey)!;
      await pool.close();
      this.connections.delete(connectionKey);
      this.logger.log(`Closed connection for department: ${claveDepartamento}`);
    }
  }

  // Recargar conexión de un departamento
  async reloadDepartmentConnection(claveDepartamento: string): Promise<void> {
    await this.closeDepartmentConnection(claveDepartamento);
    await this.getConnectionByDepartmentId(claveDepartamento);
  }

  // Obtener lista de departamentos con conexiones activas
  getActiveDepartmentConnections(): { key: string; departmentId: number }[] {
    return Array.from(this.connections.keys()).map(key => ({
      key,
      departmentId: parseInt(key.replace('dept_', ''))
    }));
  }

  // Verificar si un departamento tiene conexión activa
  isDepartmentConnected(claveDepartamento: number): boolean {
    const connectionKey = `dept_${claveDepartamento}`;
    if (this.connections.has(connectionKey)) {
      const pool = this.connections.get(connectionKey)!;
      return pool.connected;
    }
    return false;
  }
}