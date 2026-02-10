import { Role } from '../enums/role.enum';

/**
 * Interface que representa o payload do usuário autenticado
 * extraído do token JWT.
 */
export interface JwtPayload {
  /** ID do usuário no Supabase Auth */
  sub: string;

  /** Email do usuário */
  email: string;

  /** Role do usuário na plataforma */
  role: Role;

  /** Timestamp de emissão do token */
  iat?: number;

  /** Timestamp de expiração do token */
  exp?: number;
}

/**
 * Interface que representa o usuário autenticado
 * anexado ao request após validação do JWT.
 */
export interface AuthenticatedUser {
  /** ID interno do usuário (tabela User do Prisma) */
  id: string;

  /** ID do usuário no Supabase Auth */
  supabaseAuthId: string;

  /** Email do usuário */
  email: string;

  /** Role do usuário */
  role: Role;
}
