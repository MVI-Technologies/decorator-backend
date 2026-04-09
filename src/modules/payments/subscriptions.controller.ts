import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UnauthorizedException,
  Logger,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiExcludeEndpoint } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { MercadoPagoService } from './mercadopago.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { Public } from '../../common/decorators/public.decorator';
import { Request } from 'express';

@ApiTags('Subscriptions')
@ApiBearerAuth('JWT-auth')
@Controller('subscriptions')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}

  @Get('status')
  @Roles(Role.PROFESSIONAL)
  @ApiOperation({ summary: 'Consultar status da sua assinatura (Mensalidade)' })
  async getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.getSubscriptionStatus(user.id);
  }

  @Post('subscribe')
  @Roles(Role.PROFESSIONAL)
  @ApiOperation({ summary: 'Gerar link/assinatura no Mercado Pago para pagar a mensalidade' })
  async subscribe(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.subscribe(user.id);
  }

  /**
   * GET /api/v1/subscriptions/verify-payment?payment_id=xxx
   *
   * Chamado pelo frontend na página de retorno do checkout do Mercado Pago.
   * Verifica diretamente na API do MP se o pagamento foi aprovado e ativa
   * a assinatura imediatamente, sem depender do webhook ter chegado antes.
   *
   * Resolve condições de corrida onde o usuário retorna ao app antes do
   * webhook ser processado (timing issue comum no fluxo de checkout).
   */
  @Get('verify-payment')
  @Roles(Role.PROFESSIONAL)
  @ApiOperation({
    summary: 'Verificar e ativar assinatura após retorno do checkout MP',
    description:
      'Deve ser chamado pela página de retorno do Mercado Pago com o payment_id da URL. ' +
      'Consulta o status real na API do MP e ativa a assinatura se aprovado.',
  })
  @ApiQuery({ name: 'payment_id', required: true, type: String })
  async verifyPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Query('payment_id') paymentId: string,
  ) {
    return this.subscriptionsService.verifyAndActivateFromPayment(user.id, paymentId);
  }

  /**
   * POST /api/v1/subscriptions/webhook/mercadopago-subscriptions
   *
   * Webhook do Mercado Pago focado em Assinaturas (PreApproval / subscription_preapproval).
   * Valida assinatura HMAC x-signature antes de processar.
   * Retorna sempre 200 para evitar reenvios desnecessários (exceto em erros de correlação).
   */
  @Post('webhook/mercadopago-subscriptions')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async mercadoPagoWebhook(
    @Req() req: Request,
    @Body() body: any,
    @Query('id') queryId?: string,
  ) {
    // Validar assinatura HMAC (igual ao PaymentsController — sem validação aceita em dev mode)
    const isValid = this.mercadoPagoService.validateWebhookSignature({
      xSignature: req.headers['x-signature'] as string | undefined,
      xRequestId: req.headers['x-request-id'] as string | undefined,
      queryId,
    });

    if (!isValid) {
      this.logger.warn('Webhook assinatura MP rejeitado: assinatura HMAC inválida');
      throw new UnauthorizedException('Assinatura do webhook inválida');
    }

    // Aceitar tanto `type` quanto `topic` (o MP usa ambos dependendo da versão)
    const eventType = body?.type || body?.topic;

    if (eventType !== 'subscription_preapproval' && eventType !== 'preapproval') {
      this.logger.log(
        `[SubscriptionWH] Evento ignorado: type=${body?.type} topic=${body?.topic}`,
      );
      return { received: true };
    }

    if (body?.data?.id) {
      this.logger.log(`[SubscriptionWH] Processando preapproval id=${body.data.id}`);
      await this.subscriptionsService.handleSubscriptionWebhook(body.data.id);
    } else {
      this.logger.warn('[SubscriptionWH] Webhook sem data.id — ignorado');
    }

    return { received: true };
  }
}
