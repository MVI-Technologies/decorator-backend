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
    
    // 2. Se já existe um plano MP guardado numa "chave global" ou criamos aqui por demanda
    // Vamos criar ou tentar reaproveitar do profile se possível, mas ideal é ter um plano fixo do sistema.
    // Como simplificação, criaremos um plano para esse Request (ou na real, a API permite criar plan todo hora).
    let planId = (profile as any).mpPreapprovalPlanId;
    if (!planId) {
      planId = await this.mercadoPagoService.createSubscriptionPlan(config.monthlyFee);
      // Salva o planId no profile
      await this.prisma.professionalProfile.update({
        where: { id: profile.id },
        data: { mpPreapprovalPlanId: planId } as any,
      });
    }

    // 3. Criar a assinatura (PreApprovalLink)
    const result = await this.mercadoPagoService.createSubscriptionLink(
      planId,
      profile.id,
      user.email,
    );

    return { checkoutUrl: result.checkoutUrl };
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
      const profileId = subscription.external_reference;
      
      if (!profileId) {
        this.logger.warn(`Assinatura ${subscriptionId} sem external_reference.`);
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
