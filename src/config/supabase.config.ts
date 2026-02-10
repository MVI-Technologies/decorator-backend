import { registerAs } from '@nestjs/config';

/**
 * Configuração de integração com Supabase.
 * Usado para Auth e Storage.
 */
export default registerAs('supabase', () => ({
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  jwtSecret: process.env.SUPABASE_JWT_SECRET,
}));
