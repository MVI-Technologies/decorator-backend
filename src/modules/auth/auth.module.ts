import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Módulo de Autenticação e Autorização.
 *
 * Integra:
 * - Supabase Auth (signup, signin, reset password)
 * - Passport JWT (validação de tokens)
 * - Guards globais (JwtAuthGuard, RolesGuard)
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('supabase.jwtSecret') || 'fallback-secret',
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn', '7d') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SupabaseService,
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [SupabaseService, JwtAuthGuard],
})
export class AuthModule {}
