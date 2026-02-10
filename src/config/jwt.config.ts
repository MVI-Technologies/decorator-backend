import { registerAs } from '@nestjs/config';

/**
 * Configuração JWT para autenticação.
 */
export default registerAs('jwt', () => ({
  secret: process.env.SUPABASE_JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRATION || '7d',
}));
