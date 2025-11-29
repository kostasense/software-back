import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('activities')
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  private readonly logger = new Logger(ActivitiesController.name);

  constructor(private readonly activitiesService: ActivitiesService) {}

  // Obtener todas las actividades
  @Get()
  async getAllActivities() {
    this.logger.log('Obteniendo todas las actividades');
    
    try {
      const activities = await this.activitiesService.getAllActivities();
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        data: activities,
      };
    } catch (error) {
      this.logger.error(`Error al obtener actividades: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Obtener actividad por ID
  @Get(':claveActividad')
  async getActivityById(@Param('claveActividad') claveActividad: string) {
    this.logger.log(`Obteniendo actividad: ${claveActividad}`);
    
    try {
      const activity = await this.activitiesService.getActivityById(claveActividad);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        data: activity,
      };
    } catch (error) {
      this.logger.error(`Error al obtener actividad: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Obtener documentos vinculados con una actividad
  @Get(':claveActividad/documentos')
  async getDocumentsByActivity(@Param('claveActividad') claveActividad: string) {
    this.logger.log(`Obteniendo documentos de la actividad: ${claveActividad}`);
    
    try {
      const documents = await this.activitiesService.getDocumentsByActivity(claveActividad);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        data: documents,
      };
    } catch (error) {
      this.logger.error(`Error al obtener documentos: ${error.message}`, error.stack);
      throw error;
    }
  }
}