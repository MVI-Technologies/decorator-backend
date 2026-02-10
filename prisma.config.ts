import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI config (Prisma 6+).
 * DATABASE_URL continua no schema.prisma; seed migrado do package.json.
 * dotenv carrega .env para o CLI (quando prisma.config.ts existe, o Prisma não carrega .env sozinho).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
});
