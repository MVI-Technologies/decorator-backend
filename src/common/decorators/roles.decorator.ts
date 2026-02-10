import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

/** Chave de metadata usada pelo RolesGuard */
export const ROLES_KEY = 'roles';

/**
 * Decorator que define quais roles têm acesso ao endpoint.
 * Exemplo: @Roles(Role.ADMIN, Role.CLIENT)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
