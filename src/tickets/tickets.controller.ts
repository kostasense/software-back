import { 
  Controller, 
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  ParseIntPipe
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  private readonly logger = new Logger(TicketsController.name);

  constructor(private readonly ticketsService: TicketsService) {}

  // Crear ticket individual
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTicket(
    @Body() createTicketDto: {
      motivo: string;
      claveProfesor: number;
      claveDepartamento: number;
    }
  ) {
    this.logger.log('Creando nuevo ticket');
    
    try {
      const result = await this.ticketsService.createTicket(createTicketDto);
      
      return {
        success: true,
        statusCode: HttpStatus.CREATED,
        message: 'Ticket creado exitosamente',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error al crear ticket: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Obtener ticket por claveTicketGeneral
  @Get(':claveTicketGeneral')
  async getTicket(
    @Param('claveTicketGeneral', ParseIntPipe) claveTicketGeneral: number
  ) {
    this.logger.log(`Obteniendo ticket: ${claveTicketGeneral}`);
    
    try {
      const result = await this.ticketsService.getTicket(claveTicketGeneral);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error al obtener ticket: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Actualizar ticket (agregar resolución)
  @Patch(':claveTicket')
  async updateTicket(
    @Param('claveTicket', ParseIntPipe) claveTicket: number,
    @Body('resolucion') resolucion: string
  ) {
    this.logger.log(`Actualizando ticket: ${claveTicket}`);
    
    try {
      const result = await this.ticketsService.updateTicket(claveTicket, resolucion);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Ticket actualizado exitosamente',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error al actualizar ticket: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Crear ticket general
  @Post('general')
  @HttpCode(HttpStatus.CREATED)
  async createGeneralTicket(
    @Body() createGeneralTicketDto: {
      motivo: string;
      claveProfesor: number;
    }
  ) {
    this.logger.log('Creando nuevo ticket general');
    
    try {
      const result = await this.ticketsService.createGeneralTicket(createGeneralTicketDto);
      
      return {
        success: true,
        statusCode: HttpStatus.CREATED,
        message: 'Ticket general creado exitosamente',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error al crear ticket general: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Obtener resoluciones de un ticket general
  @Get('general/:claveTicketGeneral/resolutions')
  async getGeneralTicketResolutions(
    @Param('claveTicketGeneral', ParseIntPipe) claveTicketGeneral: number
  ) {
    this.logger.log(`Obteniendo resoluciones del ticket general: ${claveTicketGeneral}`);
    
    try {
      const result = await this.ticketsService.getGeneralTicketResolutions(claveTicketGeneral);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error al obtener resoluciones: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Actualizar ticket general
  @Patch('general/:claveTicketGeneral')
  async updateGeneralTicket(
    @Param('claveTicketGeneral', ParseIntPipe) claveTicketGeneral: number,
    @Body() updateDto: {
      resolucion: string;
      claveDepartamento: number;
    }
  ) {
    this.logger.log(`Actualizando ticket general: ${claveTicketGeneral}`);
    
    try {
      const result = await this.ticketsService.updateGeneralTicket(
        claveTicketGeneral,
        updateDto.resolucion,
        updateDto.claveDepartamento
      );
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Ticket general actualizado exitosamente',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error al actualizar ticket general: ${error.message}`, error.stack);
      throw error;
    }
  }
}