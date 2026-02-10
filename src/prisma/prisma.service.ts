import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Service singleton para acesso ao banco de dados via Prisma.
 * Gerencia a conexão com o PostgreSQL do Supabase.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
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
