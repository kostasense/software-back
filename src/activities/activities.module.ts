import { Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { MssqlModule } from '@strongnguyen/nestjs-mssql';

@Module({
  imports: [MssqlModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService], // Exportamos el servicio para que otros módulos puedan usarlo
})
export class ActivitiesModule {}