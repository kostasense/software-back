import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ValidationServices } from './validation.services';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { Requirement, ValidationStatus } from './interfaces/validation.interface';

interface ApiResponse<T = any> {
  success: boolean;
  statusCode: HttpStatus;
  message?: string;
  data?: T;
}

@Controller('validation')
@UseGuards(JwtAuthGuard)
export class ValidationController {
  private readonly logger = new Logger(ValidationController.name);

  constructor(
    private readonly validationService: ValidationServices,
    private readonly usersService: UsersService,
  ) {}

  // Obtener status de validación de requisitos por claveUsuario
  @Get('requisitos/:claveUsuario')
  async getValidationStatus(
    @Param('claveUsuario') claveUsuario: string
  ): Promise<ApiResponse<ValidationStatus>> {
    this.logger.log(`Obteniendo status de validación para usuario: ${claveUsuario}`);
    
    try {
      // Verificar que el usuario existe y obtener claveDocente
      const user = await this.usersService.findByClaveUsuario(claveUsuario);
      if (!user || !user.ClaveDocente) {
        return {
          success: false,
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Usuario o docente no encontrado',
        };
      }

      const requisitos = await this.validationService.requisitosIniciales(user.ClaveDocente);
      
      // Calcular estadísticas
      const totalRequisitos = requisitos.length;
      const requisitosCumplidos = requisitos.filter(req => req.value === true).length;
      const porcentajeCumplimiento = totalRequisitos > 0 
        ? Math.round((requisitosCumplidos / totalRequisitos) * 100) 
        : 0;

      const validationStatus: ValidationStatus = {
        claveUsuario,
        claveDocente: user.ClaveDocente,
        nombreDocente: `${user.Nombre || ''} ${user.ApellidoPaterno || ''} ${user.ApellidoMaterno || ''}`.trim(),
        totalRequisitos,
        requisitosCumplidos,
        porcentajeCumplimiento,
        cumpleTodos: requisitosCumplidos === totalRequisitos,
        requisitos,
      };

      return {
        success: true,
        statusCode: HttpStatus.OK,
        data: validationStatus,
      };
    } catch (error) {
      this.logger.error(`Error al obtener status de validación: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Obtener detalle de validación por requisito específico
  @Get('requisitos/:claveUsuario/:tipoRequisito')
  async getValidationDetail(
    @Param('claveUsuario') claveUsuario: string,
    @Param('tipoRequisito') tipoRequisito: string
  ): Promise<ApiResponse<Requirement>> {
    this.logger.log(`Obteniendo detalle de validación para usuario: ${claveUsuario}, tipo: ${tipoRequisito}`);
    
    try {
      const user = await this.usersService.findByClaveUsuario(claveUsuario);
      if (!user || !user.ClaveDocente) {
        return {
          success: false,
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Usuario o docente no encontrado',
        };
      }

      // Aquí podrías implementar lógica específica para cada tipo de requisito
      const requisitos = await this.validationService.requisitosIniciales(user.ClaveDocente);
      const requisitoEspecifico = requisitos.find(req => 
        req.name.toLowerCase().includes(tipoRequisito.toLowerCase())
      );

      if (!requisitoEspecifico) {
        return {
          success: false,
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Tipo de requisito no encontrado',
        };
      }

      return {
        success: true,
        statusCode: HttpStatus.OK,
        data: requisitoEspecifico,
      };
    } catch (error) {
      this.logger.error(`Error al obtener detalle de validación: ${error.message}`, error.stack);
      throw error;
    }
  }
}