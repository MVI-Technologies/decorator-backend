import { ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

/**
 * Guard global de autenticação JWT.
 *
 * Todas as rotas são protegidas por padrão.
 * Para tornar uma rota pública, use o decorator @Public().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Verifica se a rota é pública antes de exigir autenticação.
   */
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Se a rota é pública, permite acesso sem autenticação
    if (isPublic) {
      return true;
    }

    // Log the request for debugging
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      this.logger.warn(`JWT Guard: No Authorization header found for ${request.method} ${request.url}`);
    } else if (!authHeader.startsWith('Bearer ')) {
      this.logger.warn(`JWT Guard: Invalid Authorization header format for ${request.method} ${request.url}: ${authHeader.substring(0, 20)}...`);
    } else {
      const token = authHeader.substring(7);
      this.logger.log(`JWT Guard: Processing request ${request.method} ${request.url} with token (first 10 chars): ${token.substring(0, 10)}...`);
    }

    // Caso contrário, delega para o AuthGuard padrão (validação JWT)
    return super.canActivate(context);
  }

  /**
   * Handle request after passport authentication
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    if (err || !user) {
      // Log detailed error information
      if (info) {
        if (info.name === 'TokenExpiredError') {
          this.logger.error(`JWT Guard: Token expired for ${request.method} ${request.url}`);
          throw new UnauthorizedException('Token expirado. Faça login novamente.');
        } else if (info.name === 'JsonWebTokenError') {
          this.logger.error(`JWT Guard: Invalid token signature for ${request.method} ${request.url}: ${info.message}`);
          throw new UnauthorizedException('Token inválido. Verifique suas credenciais.');
        } else if (info.name === 'NotBeforeError') {
          this.logger.error(`JWT Guard: Token not yet valid for ${request.method} ${request.url}`);
          throw new UnauthorizedException('Token ainda não é válido.');
        } else {
          this.logger.error(`JWT Guard: Authentication failed for ${request.method} ${request.url}: ${info.message || info}`);
        }
      }
      
      if (err) {
        this.logger.error(`JWT Guard: Error during authentication for ${request.method} ${request.url}: ${err.message}`);
      }
      
      throw err || new UnauthorizedException('Não autenticado');
    }
    
    return user;
  }
}
