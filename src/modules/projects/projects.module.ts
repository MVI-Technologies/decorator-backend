import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProposalsController } from './proposals.controller';
import { ProjectsService } from './projects.service';
import { PaymentsModule } from '../payments/payments.module';

/**
 * Módulo de Projetos.
 * Gerenciamento do ciclo de vida dos projetos.
 * Importa PaymentsModule para usar MercadoPagoService na seleção de profissional.
 */
@Module({
  imports: [PaymentsModule],
  controllers: [ProjectsController, ProposalsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
