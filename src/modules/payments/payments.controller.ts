import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { MercadoPagoService } from './mercadopago.service';
import { MercadoPagoWebhookDto, RequestWithdrawalDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { Public } from '../../common/decorators/public.decorator';
import { Request } from 'express';

/**
 * Controller de Pagamentos e Saques.
 * Gerencia dados PIX (legado), saldo, saques e o webhook do Mercado Pago.
 */
@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}

  /**
   * GET /api/v1/payments/project/:projectId/pix-info — Dados PIX para o cliente gerar QR code (MVP).
   * Cliente paga via PIX para a chave do admin; em até 4 dias úteis o admin repassa ao profissional.
   */
  @Get('project/:projectId/pix-info')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Dados para gerar QR code PIX do pagamento do projeto' })
  async getPixInfoForProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.getPixInfoForProject(projectId, user.id);
  }

  /**
   * GET /api/v1/payments/balance — Saldo do profissional
   */
  @Get('balance')
  @Roles(Role.PROFESSIONAL)
  @ApiOperation({ summary: 'Consultar saldo disponível' })
  async getBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getBalance(user.id);
  }

  /**
   * POST /api/v1/payments/withdraw — Solicitar saque
   */
  @Post('withdraw')
  @Roles(Role.PROFESSIONAL)
  @ApiOperation({ summary: 'Solicitar saque do saldo disponível' })
  async requestWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestWithdrawalDto,
  ) {
    return this.paymentsService.requestWithdrawal(user.id, dto);
  }

  /**
   * GET /api/v1/payments/withdrawals — Histórico de saques
   */
  @Get('withdrawals')
  @Roles(Role.PROFESSIONAL)
  @ApiOperation({ summary: 'Listar histórico de saques' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getWithdrawalHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.paymentsService.getWithdrawalHistory(user.id, page, limit);
  }

  /**
   * POST /api/v1/payments/webhook/mercadopago
   *
   * Endpoint público (sem JWT) chamado pelo Mercado Pago ao aprovar/recusar pagamento.
   * Valida a assinatura HMAC do header x-signature antes de processar.
   * Retorna sempre 200 para evitar reenvios desnecessários do MP.
   *
   * Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
   */
  @Post('webhook/mercadopago')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Não expor no Swagger (endpoint público)
  async mercadoPagoWebhook(
    @Req() req: Request,
    @Body() body: MercadoPagoWebhookDto,
    @Query('id') queryId?: string,
  ) {
    // 1. Validar assinatura HMAC
    const isValid = this.mercadoPagoService.validateWebhookSignature({
      xSignature: req.headers['x-signature'] as string | undefined,
      xRequestId: req.headers['x-request-id'] as string | undefined,
      queryId,
    });

    if (!isValid) {
      this.logger.warn('Webhook MP rejeitado: assinatura inválida');
      throw new UnauthorizedException('Assinatura do webhook inválida');
    }

    // 2. Processar apenas eventos de pagamento
    if (body.type !== 'payment') {
      this.logger.log(`Webhook MP ignorado: tipo=${body.type}`);
      return { received: true };
    }

    // 3. Processar o pagamento de forma assíncrona
    this.logger.log(`Webhook MP recebido: action=${body.action} paymentId=${body.data?.id}`);
    await this.paymentsService.handleMercadoPagoPayment(body.data.id);

    return { received: true };
  }
}
