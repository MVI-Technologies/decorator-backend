import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { SupabaseService } from '../supabase.service';
import { AuthenticatedUser } from '../../../common/interfaces/auth.interface';
import { Role } from '../../../common/enums/role.enum';

/**
 * Estratégia JWT personalizada para validação de tokens do Supabase Auth.
 *
 * Extrai o token do header Authorization: Bearer <token>,
 * valida usando a API do Supabase (que suporta ES256),
 * e busca o usuário correspondente no banco de dados.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {
    super();
    this.logger.log('JWT Strategy initialized to validate Supabase tokens via Supabase API');
  }

  /**
   * Valida o token extraindo do header, verificando com Supabase,
   * e buscando o usuário no banco de dados.
   */
  async validate(req: Request): Promise<AuthenticatedUser> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('No valid Authorization header found');
      throw new UnauthorizedException('Token não fornecido');
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    
    this.logger.log(`Validating token (first 15 chars): ${token.substring(0, 15)}...`);

    try {
      // Verify the token using Supabase API (handles ES256, HS256, etc.)
      const supabaseUser = await this.supabase.getUserByToken(token);

      if (!supabaseUser) {
        this.logger.error('Supabase returned no user for token');
        throw new UnauthorizedException('Token inválido');
      }

      this.logger.log(`Token verified by Supabase for user: ${supabaseUser.email}, sub: ${supabaseUser.id}`);

      // Look up user in our database
      const user = await this.prisma.user.findUnique({
        where: { supabaseAuthId: supabaseUser.id },
      });

      if (!user) {
        this.logger.error(`User not found in database for supabaseAuthId: ${supabaseUser.id}`);
        throw new UnauthorizedException('Usuário não encontrado ou inativo');
      }

      if (!user.isActive) {
        this.logger.error(`Inactive user attempted access: ${user.email} (ID: ${user.id})`);
        throw new UnauthorizedException('Usuário não encontrado ou inativo');
      }

      this.logger.log(`JWT validation successful for user: ${user.email} (ID: ${user.id}, Role: ${user.role})`);

      return {
        id: user.id,
        supabaseAuthId: user.supabaseAuthId,
        email: user.email,
        role: user.role as Role,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      this.logger.error(`Token validation failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
