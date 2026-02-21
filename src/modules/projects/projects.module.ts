import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProposalsController } from './proposals.controller';
import { ProjectsService } from './projects.service';

/**
 * Módulo de Projetos.
 * Gerenciamento do ciclo de vida dos projetos.
 * ProposalsController: alias GET /proposals/:id → mesmo que GET /projects/:id (para histórico de chats no front).
 */
@Module({
  controllers: [ProjectsController, ProposalsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
