import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MercadoPagoService } from './mercadopago.service';

const CONFIG_PROFESSIONAL_MONTHLY_FEE = 'PROFESSIONAL_MONTHLY_FEE';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}

  /**
   * Obtém as configurações atuais da assinatura ou os dados do plano (se aplicável).
   */
  async getSubscriptionConfig() {
    let feeConfig = await this.prisma.systemConfig.findUnique({
      where: { key: CONFIG_PROFESSIONAL_MONTHLY_FEE },
    });

    if (!feeConfig) {
      // Valor default se não existir
      feeConfig = await this.prisma.systemConfig.create({
        data: { key: CONFIG_PROFESSIONAL_MONTHLY_FEE, value: '21.90' },
      });
    }

    return {
      monthlyFee: parseFloat(feeConfig.value),
    };
  }

  /**
   * Consulta o status da assinatura de um profissional pelo userId
   */
  async getSubscriptionStatus(userId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });

    if (!profile) throw new NotFoundException('Perfil não encontrado');

    return {
      status: (profile as any).subscriptionStatus,
      expiresAt: (profile as any).subscriptionExpiresAt,
    };
  }

  /**
   * Inicia ou recupera o link para assinar (Checkout Bricks / Pro Assinaturas).
   */
  async subscribe(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { professionalProfile: true },
      });

      if (!user || !user.professionalProfile) {
        throw new NotFoundException('Profissional não encontrado');
      }

      const profile = user.professionalProfile;

      // Se já tiver uma assinatura ativa e válida
      if (
        (profile as any).subscriptionStatus === 'ACTIVE' &&
        (profile as any).subscriptionExpiresAt &&
        (profile as any).subscriptionExpiresAt > new Date()
      ) {
        throw new BadRequestException('Sua assinatura já está ativa.');
      }

      // 1. Verificar configuração do valor
      const config = await this.getSubscriptionConfig();

      // Sempre cria um novo plano para garantir init_point válido
      const planResult = await this.mercadoPagoService.createSubscriptionPlan(config.monthlyFee);

      // Persiste o planId mais recente no profile
      await this.prisma.professionalProfile.update({
        where: { id: profile.id },
        data: { mpPreapprovalPlanId: planResult.planId } as any,
      });

      this.logger.log(`[subscribe] Retornando checkoutUrl=${planResult.checkoutUrl}`);
      return { checkoutUrl: planResult.checkoutUrl };
    } catch (err: any) {
      console.error('------- SUBSCRIBE GENERAL ERROR -------');
      console.error(err);
      if (err.response) {
        console.error(err.response.data || err.response);
      }
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Webhook para Assinaturas Mensais
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Processa webhook de "subscription_preapproval"
   */
  async handleSubscriptionWebhook(subscriptionId: string) {
    this.logger.log(`Processando Webhook de Assinatura: ${subscriptionId}`);

    try {
      const subscription = await this.mercadoPagoService.getSubscription(subscriptionId);

      // subscription.payer_id, subscription.status, subscription.external_reference
      let profileId = subscription.external_reference;
      
      const planId = (subscription as any).preapproval_plan_id;
      if (!profileId && planId) {
        const profileByPlan = await this.prisma.professionalProfile.findFirst({
          where: { mpPreapprovalPlanId: planId } as any,
        });
        if (profileByPlan) profileId = profileByPlan.id;
      }

      if (!profileId) {
        this.logger.warn(`Assinatura ${subscriptionId} do plano ${planId} sem profissional associado.`);
        return;
      }

      const profile = await this.prisma.professionalProfile.findUnique({
        where: { id: profileId },
      });

      if (!profile) return;

      if (subscription.status === 'authorized') {
        // Atualiza para ACTIVE com expiração em 1 mês (ou o Mercado Pago controla e manda novo webhook).
        // A data de expiração pode ser calculada com base no recurring date
        const expDate = new Date();
        expDate.setMonth(expDate.getMonth() + 1);

        await this.prisma.professionalProfile.update({
          where: { id: profileId },
          data: {
            subscriptionStatus: 'ACTIVE',
            subscriptionExpiresAt: expDate,
            mpSubscriptionId: subscriptionId,
          } as any,
        });
        
        this.logger.log(`Assinatura ativa para ${profileId}`);
      } else if (subscription.status === 'cancelled' || subscription.status === 'past_due') {
        await this.prisma.professionalProfile.update({
          where: { id: profileId },
          data: {
            subscriptionStatus: subscription.status === 'cancelled' ? 'CANCELED' : 'PAST_DUE',
          } as any,
        });
      }

    } catch (err) {
      this.logger.error(`Erro ao processar assinatura ${subscriptionId}`, err);
    }
  }
}
