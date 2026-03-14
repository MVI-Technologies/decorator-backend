import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UnauthorizedException,
  Logger,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
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
   * Webhook do Mercado Pago focado apenas em Assinaturas (PreApproval)
   */
  @Post('webhook/mercadopago-subscriptions')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async mercadoPagoWebhook(@Req() req: Request, @Body() body: any) {
    // Validação simplificada para o MVP. Assinaturas geralmente caem em types diferentes
    // docs: subscription_preapproval ou preapproval
    if (body.type !== 'subscription_preapproval') {
      return { received: true };
    }

    if (body.data && body.data.id) {
      this.logger.log(`Webhook MP Preapproval recebido: id=${body.data.id}`);
      await this.subscriptionsService.handleSubscriptionWebhook(body.data.id);
    }

    return { received: true };
  }
}
