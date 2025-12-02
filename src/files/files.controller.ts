import { 
  Controller, 
  Post, 
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  Body,
  Query,
  BadRequestException,
  Get,
  Param
} from '@nestjs/common';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(private readonly filesService: FilesService) {}

  // Opción 1: Recibir claveUsuario por Body
  @Post('generate-files')
  @HttpCode(HttpStatus.OK)
  async generateFiles(
    @Body('claveUsuario') claveUsuario: string
  ) {
    this.logger.log(`Solicitud para generar archivos - Usuario: ${claveUsuario}`);
    
    try {
      const result = await this.filesService.generateFiles(claveUsuario);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Archivos generados exitosamente',
        data: result,
      };
      
    } catch (error) {
      this.logger.error(`Error al generar archivos: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Opción 2: Recibir claveUsuario por Query
  @Post('generate-files-query')
  @HttpCode(HttpStatus.OK)
  async generateFilesQuery(
    @Query('claveUsuario') claveUsuario: string
  ) {
    this.logger.log(`Solicitud para generar archivos - Usuario: ${claveUsuario}`);
    
    try {
      const result = await this.filesService.generateFiles(claveUsuario);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Archivos generados exitosamente',
        data: result,
      };
      
    } catch (error) {
      this.logger.error(`Error al generar archivos: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Get('documents')
  async getAllDocuments() {
    this.logger.log('Obteniendo todos los documentos');
    
    try {
        const documents = await this.filesService.getAllDocuments();
        
        return {
        success: true,
        statusCode: HttpStatus.OK,
        data: documents,
        total: documents.length,
        };
    } catch (error) {
        this.logger.error(`Error al obtener documentos: ${error.message}`, error.stack);
        throw error;
    }
  }

  /**
   * Obtener expedientes por clave de usuario
   * GET /files/expedientes/:claveUsuario
   */
  @Get('expedientes/:claveUsuario')
  async getExpedientesByUsuario(@Param('claveUsuario') claveUsuario: string) {
    this.logger.log(`Obteniendo expedientes del usuario: ${claveUsuario}`);
    
    if (!claveUsuario) {
      throw new BadRequestException('La clave de usuario es requerida');
    }

    try {
      const expedientes = await this.filesService.getExpedientesByClaveUsuario(claveUsuario);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        data: expedientes,
        total: expedientes.length,
        message: expedientes.length > 0 
          ? 'Expedientes obtenidos exitosamente' 
          : 'No se encontraron expedientes para este usuario'
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener expedientes del usuario ${claveUsuario}: ${error.message}`, 
        error.stack
      );
      throw error;
    }
  }

  /**
     * Obtener documentos generados de un expediente
     * GET /files/expedientes/:claveExpediente/documentos
     */
  @Get('expedientes/:claveExpediente/documentos')
  @HttpCode(HttpStatus.OK)
  async getDocumentosByExpediente(
    @Param('claveExpediente') claveExpediente: string
  ) {
    this.logger.log(`Obteniendo documentos del expediente: ${claveExpediente}`);
    try {
        const documentos = await this.filesService.getDocumentosByExpediente(claveExpediente);
        
        return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Documentos obtenidos exitosamente',
        data: documentos,
        total: documentos.length
        };
    } catch (error) {
        this.logger.error(`Error al obtener documentos del expediente: ${error.message}`, error.stack);
        throw error;
    }
  }
}