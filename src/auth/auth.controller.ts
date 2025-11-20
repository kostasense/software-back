import { 
  Controller, 
  Post, 
  Body, 
  HttpCode, 
  HttpStatus,
  UseGuards,
  Request,
  Get,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Res() res: Response) {
    const result = await this.authService.login(loginDto.correo, loginDto.contrasena);
    
    if (!result.success) {
      return res.status(result.statusCode).json(result);
    }
    
    return res.status(200).json(result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto, @Res() res: Response) {
    const result = await this.authService.refreshTokens(refreshTokenDto.refreshToken);
    
    if (!result.success) {
      return res.status(result.statusCode).json(result);
    }
    
    return res.status(200).json(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req) {
    // En una implementación real, podrías invalidar el token aquí
    // Por ejemplo, agregándolo a una lista negra en Redis
    return {
      success: true,
      statusCode: 200,
      message: 'Logged out successfully',
    };
  }

  @Get('profile')
  async getProfile(@Request() req) {
    return {
      success: true,
      statusCode: 200,
      data: {
        id: req.user.userId,
        email: req.user.email,
        roles: req.user.roles,
      },
    };
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validateToken() {
    return {
      success: true,
      statusCode: 200,
      message: 'Token is valid',
    };
  }
}