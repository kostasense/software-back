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
      claveDocumento: string;
      claveUsuario: string;
    }
  ) {
    this.logger.log('Creando nuevo ticket');
    
    try {
      const result = await this.ticketsService.createTicketByUsuario(createTicketDto);
      
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

  // Obtener tickets por claveUsuario/Docente
  @Get('usuario/:claveUsuario')
  async getTicketsByUsuario(@Param('claveUsuario') claveUsuario: string) {
    this.logger.log(`Obteniendo tickets del usuario: ${claveUsuario}`);
    
    try {
      const tickets = await this.ticketsService.getTicketsByUsuario(claveUsuario);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        data: tickets,
      };
    } catch (error) {
      this.logger.error(`Error al obtener tickets: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Actualizar ticket (agregar resolución)
  @Patch(':claveTicket')
  async updateTicket(
    @Param('claveTicket') claveTicket: string,
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

  // Obtener ticket por clave
  @Get('ticket/:claveTicket')
  async getTicketByKey(@Param('claveTicket') claveTicket: string) {
    this.logger.log(`Obteniendo ticket: ${claveTicket}`);
    
    try {
      const result = await this.ticketsService.getTicketByKey(claveTicket);
      
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

  // === TICKETS GENERALES ===

  // Crear ticket general
  @Post('general')
  @HttpCode(HttpStatus.CREATED)
  async createGeneralTicket(
    @Body() createGeneralTicketDto: {
      motivo: string;
      claveUsuario: string; // Usuario que crea el ticket
    }
  ) {
    this.logger.log('Creando nuevo ticket general');
    
    try {
      const result = await this.ticketsService.createGeneralTicketByUsuario(createGeneralTicketDto);
      
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

  // Obtener ticket general por clave
  @Get('general/:claveTicketGeneral')
  async getGeneralTicket(@Param('claveTicketGeneral') claveTicketGeneral: string) {
    this.logger.log(`Obteniendo ticket general: ${claveTicketGeneral}`);
    
    try {
      const result = await this.ticketsService.getTicket(claveTicketGeneral);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error al obtener ticket general: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Obtener tickets generales por usuario
  @Get('general/usuario/:claveUsuario')
  async getGeneralTicketsByUsuario(@Param('claveUsuario') claveUsuario: string) {
    this.logger.log(`Obteniendo tickets generales del usuario: ${claveUsuario}`);
    
    try {
      const tickets = await this.ticketsService.getGeneralTicketsByUsuario(claveUsuario);
      
      return {
        success: true,
        statusCode: HttpStatus.OK,
        data: tickets,
      };
    } catch (error) {
      this.logger.error(`Error al obtener tickets generales: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Obtener resoluciones de un ticket general
  @Get('general/:claveTicketGeneral/resolutions')
  async getGeneralTicketResolutions(
    @Param('claveTicketGeneral') claveTicketGeneral: string
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
    @Param('claveTicketGeneral') claveTicketGeneral: string,
    @Body() updateDto: {
      resolucion: string;
      claveDepartamento: string;
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