import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * Service singleton para acesso ao banco de dados via Prisma.
 * Gerencia a conexão com o PostgreSQL do Supabase.
 * Usa DATABASE_URL do ConfigService (mesmo .env que o Nest carrega).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    let url = configService.get<string>('DATABASE_URL');
    if (!url) {
      throw new Error(
        'DATABASE_URL não está definida. Verifique o arquivo .env na raiz do projeto.',
      );
    }
    // Timeout maior para redes lentas ou pooler Supabase (evita P1001 por timeout)
    const separator = url.includes('?') ? '&' : '?';
    if (!url.includes('connect_timeout')) {
      url = `${url}${separator}connect_timeout=30`;
    }
    super({
      datasources: {
        db: { url },
      },
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Conectando ao banco de dados...');
    await this.$connect();
    this.logger.log('Conexão com o banco de dados estabelecida.');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Desconectando do banco de dados...');
    await this.$disconnect();
    this.logger.log('Conexão com o banco de dados encerrada.');
  }
}
