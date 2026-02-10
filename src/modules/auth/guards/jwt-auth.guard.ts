import { ExecutionContext, Injectable } from '@nestjs/common';
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

    // Caso contrário, delega para o AuthGuard padrão (validação JWT)
    return super.canActivate(context);
  }
}
