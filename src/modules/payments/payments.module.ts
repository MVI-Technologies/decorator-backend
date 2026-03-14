import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MercadoPagoService } from './mercadopago.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Módulo de Pagamentos, Saques, integração Mercado Pago e Assinaturas
 */
@Module({
  controllers: [PaymentsController, SubscriptionsController],
  providers: [PaymentsService, MercadoPagoService, SubscriptionsService],
  exports: [PaymentsService, MercadoPagoService, SubscriptionsService],
})
export class PaymentsModule {}
