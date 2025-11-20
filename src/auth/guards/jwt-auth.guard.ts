import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }
    
    return super.canActivate(context);
  }

  handleRequest(err, user, info, context: ExecutionContext) {
    const response = context.switchToHttp().getResponse();
    
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        response.status(401).json({
          success: false,
          statusCode: 401,
          message: 'Access token expired',
          error: 'TOKEN_EXPIRED',
          requiresRefresh: true,
        });
        return null;
      }
      
      response.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Invalid or missing token',
        error: 'UNAUTHORIZED',
        requiresLogin: true,
      });
      return null;
    }
    
    return user;
  }
}