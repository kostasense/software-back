import { 
  Controller, 
  Post, 
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  Body,
  Query,
  BadRequestException
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
}