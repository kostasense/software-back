import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';
import { AuthResponse } from './interfaces/auth-response.interface';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiration: string;
  private readonly jwtRefreshExpiration: string;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
    this.jwtExpiration = process.env.JWT_EXPIRATION || '2h';
    this.jwtRefreshExpiration = process.env.JWT_REFRESH_EXPIRATION || '5h';
  }

  async validateUser(correo: string, contrasena: string): Promise<any> {
    const user = await this.usersService.findByEmail(correo);
    
    if (user && await bcrypt.compare(contrasena, user.Contrasena)) {
      const { Contrasena, ...result } = user;
      return result;
    }
    
    return null;
  }

  async login(correo: string, contrasena: string): Promise<AuthResponse> {
    const user = await this.validateUser(correo, contrasena);
    
    if (!user) {
      return {
        success: false,
        statusCode: 401,
        message: 'Credenciales inválidas',
        error: 'INVALID_CREDENTIALS',
        data: null,
      };
    }

    const tokens = await this.generateTokens(user);
    
    return {
      success: true,
      statusCode: 200,
      data: {
        ...tokens,
        user: {
          claveUsuario: user.ClaveUsuario,
          correo: user.Correo,
          rol: user.Rol,
          claveDepartamento: user.ClaveDepartamento,
          claveDocente: user.ClaveDocente,
        },
      },
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    try {
      // Verificar el refresh token
      const payload = await this.verifyRefreshToken(refreshToken);
      
      // Buscar el usuario
      const user = await this.usersService.findByClaveUsuario(payload.sub);
      
      if (!user) {
        return {
          success: false,
          statusCode: 401,
          message: 'Usuario no encontrado',
          error: 'USER_NOT_FOUND',
          requiresLogin: true,
          data: null,
        };
      }

      // Generar nuevos tokens
      const tokens = await this.generateTokens(user);
      
      return {
        success: true,
        statusCode: 200,
        data: {
          ...tokens,
          user: {
            claveUsuario: user.ClaveUsuario,
            correo: user.Correo,
            rol: user.Rol,
            claveDepartamento: user.ClaveDepartamento,
            claveDocente: user.ClaveDocente,
          },
        },
      };
    } catch (error) {
      // Si el refresh token está expirado o es inválido
      if (error.name === 'TokenExpiredError') {
        return {
          success: false,
          statusCode: 401,
          message: 'El token de actualización ha expirado. Por favor inicie sesión nuevamente',
          error: 'REFRESH_TOKEN_EXPIRED',
          requiresLogin: true,
          data: null,
        };
      }
      
      return {
        success: false,
        statusCode: 401,
        message: 'Token de actualización inválido',
        error: 'INVALID_REFRESH_TOKEN',
        requiresLogin: true,
        data: null,
      };
    }
  }

  private async generateTokens(user: any) {
    const payload: Record<string, any> = {
      correo: user.Correo,
      sub: user.ClaveUsuario, // sub ahora contiene ClaveUsuario
      claveUsuario: user.ClaveUsuario,
      rol: user.Rol,
      claveDepartamento: user.ClaveDepartamento || null,
      claveDocente: user.ClaveDocente || null,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: '2h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.jwtRefreshSecret,
      expiresIn: '5h',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 7200, // 2 horas en segundos
      tokenType: 'Bearer',
    };
  }

  private verifyRefreshToken(token: string): any {
    return this.jwtService.verify(token, {
      secret: this.jwtRefreshSecret,
    });
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      this.jwtService.verify(token, {
        secret: this.jwtSecret,
      });
      return true;
    } catch {
      return false;
    }
  }

  // Método adicional para obtener información del token
  decodeToken(token: string): any {
    try {
      return this.jwtService.decode(token);
    } catch {
      return null;
    }
  }
}