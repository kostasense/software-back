import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Request,
  UseGuards,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Obtener info del usuario autenticado
  @Get('me')
  async getMyInfo(@Request() req) {
    const user = await this.usersService.findByClaveUsuario(req.user.claveUsuario);
    return {
      success: true,
      statusCode: 200,
      data: user,
    };
  }

  // Obtener todos los usuarios
  @Get()
  async getAllUsers() {
    const users = await this.usersService.getAll();
    return {
      success: true,
      statusCode: 200,
      data: users,
    };
  }

  // Obtener usuario por ClaveUsuario
  @Get(':claveUsuario')
  async getUserByClaveUsuario(@Param('claveUsuario', ParseIntPipe) claveUsuario: number) {
    const user = await this.usersService.findByClaveUsuario(claveUsuario);
    
    if (!user) {
      return {
        success: false,
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Usuario no encontrado',
      };
    }
    
    return {
      success: true,
      statusCode: 200,
      data: user,
    };
  }

  // Editar datos del usuario
  @Patch(':claveUsuario')
  async updateUser(
    @Param('claveUsuario', ParseIntPipe) claveUsuario: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const result = await this.usersService.updateUser(claveUsuario, updateUserDto);
    
    if (!result) {
      return {
        success: false,
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Usuario no encontrado',
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: 'Usuario actualizado exitosamente',
      data: result,
    };
  }

  // Obtener usuarios de un departamento específico
  @Get('department/:claveDepartamento')
  async getUsersByDepartment(@Param('claveDepartamento', ParseIntPipe) claveDepartamento: number) {
    try {
      const users = await this.usersService.getAllUsersFromAllDepartments();
      const departmentUsers = users.find(dept => dept.claveDepartamento === claveDepartamento);
      
      return {
        success: true,
        statusCode: 200,
        data: departmentUsers || { usuarios: [] },
      };
    } catch (error) {
      return {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message,
      };
    }
  }

  // Actualizar mi información (usuario autenticado)
  @Patch('me/update')
  async updateMyInfo(
    @Request() req,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const result = await this.usersService.updateUser(req.user.claveUsuario, updateUserDto);
    
    return {
      success: true,
      statusCode: 200,
      message: 'Información actualizada exitosamente',
      data: result,
    };
  }
}