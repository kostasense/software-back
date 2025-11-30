// src/validation/validation.module.ts
import { Module } from '@nestjs/common';
import { ValidationController } from './validation.controller';
import { ValidationServices } from './validation.services';
import { MssqlModule } from '@strongnguyen/nestjs-mssql';
import { FilesModule } from '../files/files.module';
import { UsersModule } from '../users/users.module';
import { DynamicDatabaseService } from 'src/database/dynamic-database.service';

@Module({
  imports: [
    MssqlModule,
    FilesModule,
    UsersModule,
  ],
  controllers: [ValidationController],
  providers: [ValidationServices, DynamicDatabaseService],
  exports: [ValidationServices],
})
export class ValidationModule {}