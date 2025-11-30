import { Global, Module, Logger } from '@nestjs/common';
import { MssqlModule, MssqlService } from '@strongnguyen/nestjs-mssql';
import { DynamicDatabaseService } from './dynamic-database.service';
import * as sql from 'mssql';

@Global()
@Module({
  imports: [
    MssqlModule.registerAsync({
      useFactory: async () => {
        const logger = new Logger('DatabaseModule');
        const connectionUrl = process.env.DATABASE_URL;
        
        if (!connectionUrl) {
          logger.error('DATABASE_URL no está definida en las variables de entorno');
          throw new Error('DATABASE_URL is required');
        }

        try {
          const url = new URL(connectionUrl);
          
          const config = {
            server: url.hostname,
            port: parseInt(url.port) || 1433,
            user: url.username,
            password: decodeURIComponent(url.password),
            database: url.pathname.slice(1),
            options: {
              encrypt: false,
              trustServerCertificate: true,
              enableArithAbort: true,
              connectTimeout: 30000,
            },
            pool: {
              max: 10,
              min: 1,
              idleTimeoutMillis: 30000,
            },
          };

          logger.log('=== Configuración de base de datos ===');
          logger.log(`Server: ${config.server}:${config.port}`);
          logger.log(`Database: ${config.database}`);
          logger.log(`User: ${config.user}`);
          logger.log(`Password: ${config.password ? '***' : 'NO PASSWORD'}`);
          logger.log('=====================================');

          // Probar la conexión antes de retornar la configuración
          try {
            const testPool = await sql.connect(config as sql.config);
            const result = await testPool.request().query('SELECT 1 AS test');
            
            if (result.recordset[0].test === 1) {
              logger.log('Prueba de conexión exitosa');
            }
            
            await testPool.close();
          } catch (testError) {
            logger.error('Error en prueba de conexión:', testError.message);
          }

          return config;
        } catch (error) {
          logger.error('Error al parsear DATABASE_URL:', error.message);
          throw error;
        }
      },
    }),
  ],
  providers: [DynamicDatabaseService],
  exports: [MssqlModule, DynamicDatabaseService],
})
export class DatabaseModule {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(private readonly mssqlService: MssqlService) {
    // Verificar la conexión después de que el servicio se inyecte
    this.verifyConnection();
  }

  private async verifyConnection() {
    // Esperar un momento para asegurar que todo esté inicializado
    setTimeout(async () => {
      try {
        this.logger.log('Verificando conexión con la base de datos...');
        
        const pool = this.mssqlService.getPool();
        
        if (!pool) {
          this.logger.warn('El pool aún no está disponible, esperando...');
          setTimeout(() => this.verifyConnection(), 2000);
          return;
        }

        const result = await pool.request().query('SELECT DB_NAME() AS DatabaseName');
        
        if (result.recordset[0]) {
          this.logger.log('Conexión establecida con la base de datos');
          this.logger.log(`Base de datos conectada: ${result.recordset[0].DatabaseName}`);
        }
      } catch (error) {
        this.logger.error('Error al verificar conexión:', error.message);
      }
    }, 2000);
  }
}