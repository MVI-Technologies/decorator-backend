import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

/**
 * Guard que verifica se o usuário autenticado possui a role necessária
 * para acessar o endpoint. Trabalha em conjunto com o decorator @Roles().
 *
 * Se o endpoint estiver marcado com @Public(), o guard permite acesso.
 * Se nenhuma role for especificada, o guard permite acesso (apenas autenticação).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Verifica se o endpoint é público
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Obtém as roles necessárias do decorator
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Se nenhuma role foi especificada, permite acesso (apenas autenticação é necessária)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Verifica se o usuário possui uma das roles necessárias
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user?.role === role);
  }
}
