import { Global, Module } from '@nestjs/common';
import { MssqlModule } from '@strongnguyen/nestjs-mssql';
import { DynamicDatabaseService } from './dynamic-database.service';

@Global()
@Module({
  imports: [
    MssqlModule.registerAsync({
      useFactory: () => {

        const connectionUrl = process.env.DATABASE_URL!;
        const url = new URL(connectionUrl);
        
        return {
          server: url.hostname,
          port: parseInt(url.port) || 1433,
          user: url.username,
          password: url.password,
          database: url.pathname.slice(1),
          options: {
            encrypt: false,
            trustServerCertificate: true,
          },
          pool: {
            max: 10,
            min: 1,
            idleTimeoutMillis: 30000,
          },
        };
      },
    }),
  ],
  providers: [DynamicDatabaseService],
  exports: [MssqlModule, DynamicDatabaseService],
})
export class DatabaseModule {}
