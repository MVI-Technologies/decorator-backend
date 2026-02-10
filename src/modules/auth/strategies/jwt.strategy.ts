import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../../../common/interfaces/auth.interface';
import { Role } from '../../../common/enums/role.enum';

/**
 * Estratégia JWT para validação de tokens do Supabase Auth.
 *
 * Extrai o token do header Authorization: Bearer <token>,
 * valida a assinatura usando o SUPABASE_JWT_SECRET,
 * e busca o usuário correspondente no banco de dados.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const jwtSecret = configService.get<string>('supabase.jwtSecret');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret || 'fallback-secret',
    });
  }

  /**
   * Chamado automaticamente pelo Passport após a validação da assinatura do JWT.
   * Busca o usuário no banco pelo supabaseAuthId (campo 'sub' do token).
   *
   * @param payload - Payload decodificado do JWT do Supabase
   * @returns AuthenticatedUser que será anexado ao request
   */
  async validate(payload: { sub: string; email: string }): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { supabaseAuthId: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário não encontrado ou inativo');
    }

    return {
      id: user.id,
      supabaseAuthId: user.supabaseAuthId,
      email: user.email,
      role: user.role as Role,
    };
  }
}
