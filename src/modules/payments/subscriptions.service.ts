import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
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
        data: { key: CONFIG_PROFESSIONAL_MONTHLY_FEE, value: '1.00' },
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

    const config = await this.getSubscriptionConfig();

    return {
      status: (profile as any).subscriptionStatus,
      expiresAt: (profile as any).subscriptionExpiresAt,
      monthlyFee: config.monthlyFee,
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

      // Agora criamos uma preferência comum (para permitir usar PIX) em vez de plano de recorrência
      const prefResult = await this.mercadoPagoService.createPreference({
        projectId: profile.id, // Passamos o perfil no projectId
        projectTitle: 'Mensalidade Decornet - Profissional',
        clientName: user.name,
        clientEmail: user.email,
        price: config.monthlyFee,
        isSubscription: true,
      });

      // Persiste o planId mais recente no profile (vamos usar para salvar a preference gerada)
      await this.prisma.professionalProfile.update({
        where: { id: profile.id },
        data: { mpPreapprovalPlanId: prefResult.preferenceId } as any,
      });

      this.logger.log(`[subscribe] Retornando checkoutUrl=${prefResult.checkoutUrl} (Com suporte a PIX)`);
      return { checkoutUrl: prefResult.checkoutUrl };
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
    this.logger.log(`[SubscriptionWebhook] Início: subscriptionId=${subscriptionId}`);

    let subscription: any;
    try {
      subscription = await this.mercadoPagoService.getSubscription(subscriptionId);
    } catch (err) {
      this.logger.error(`[SubscriptionWebhook] Falha ao consultar MP: subscriptionId=${subscriptionId}`, err);
      // Relança para que o MP reenvia o webhook (não retorna 200 silenciosamente)
      throw new InternalServerErrorException('Falha ao consultar status da assinatura no Mercado Pago');
    }

    this.logger.log(
      `[SubscriptionWebhook] MP retornou: status=${subscription.status} ` +
        `external_reference=${subscription.external_reference} ` +
        `preapproval_plan_id=${(subscription as any).preapproval_plan_id}`,
    );

    // 1. Tentar correlacionar pelo external_reference (forma correta)
    let profileId: string | undefined | null = subscription.external_reference;

    // 2. Fallback: buscar pelo mpPreapprovalPlanId (salvo na criação do plano)
    const planId = (subscription as any).preapproval_plan_id;
    if (!profileId && planId) {
      this.logger.log(
        `[SubscriptionWebhook] Sem external_reference — fallback pelo planId=${planId}`,
      );
      const profileByPlan = await this.prisma.professionalProfile.findFirst({
        where: { mpPreapprovalPlanId: planId } as any,
      });
      if (profileByPlan) {
        profileId = profileByPlan.id;
        this.logger.log(
          `[SubscriptionWebhook] Perfil encontrado pelo planId: profileId=${profileId}`,
        );
      }
    }

    if (!profileId) {
      this.logger.error(
        `[SubscriptionWebhook] ❌ Nenhum profissional associado à assinatura ${subscriptionId} ` +
          `(planId=${planId}). Verifique se external_reference está sendo enviado na criação.`,
      );
      // Lança erro para o MP reenviar — NÃO retorna 200 silenciosamente (BUG original)
      throw new InternalServerErrorException(
        `Assinatura ${subscriptionId} sem profissional associado — não é possível processar`,
      );
    }

    const profile = await this.prisma.professionalProfile.findUnique({
      where: { id: profileId as string },
    });

    if (!profile) {
      this.logger.error(
        `[SubscriptionWebhook] Perfil ${profileId} não existe no banco (subscriptionId=${subscriptionId})`,
      );
      return; // Perfil deletado — não há o que fazer, aceitar silenciosamente
    }

    const subStatus = subscription.status;
    this.logger.log(`[SubscriptionWebhook] Processando status=${subStatus} para profileId=${profileId}`);

    if (subStatus === 'authorized' || subStatus === 'active') {
      // Idempotência
      if (
        (profile as any).mpSubscriptionId === subscriptionId &&
        (profile as any).subscriptionStatus === 'ACTIVE'
      ) {
        this.logger.log(
          `[SubscriptionWebhook] Idempotência: assinatura já ativa subscriptionId=${subscriptionId}`,
        );
        return;
      }

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

      this.logger.log(
        `✅ [SubscriptionWebhook] Assinatura ativada: profileId=${profileId} expires=${expDate.toISOString()}`,
      );
    } else if (subStatus === 'cancelled' || subStatus === 'past_due') {
      const newStatus = subStatus === 'cancelled' ? 'CANCELED' : 'PAST_DUE';
      await this.prisma.professionalProfile.update({
        where: { id: profileId },
        data: { subscriptionStatus: newStatus } as any,
      });
      this.logger.log(
        `[SubscriptionWebhook] Status atualizado para ${newStatus}: profileId=${profileId}`,
      );
    } else {
      this.logger.log(
        `[SubscriptionWebhook] Status ${subStatus} não requer ação: profileId=${profileId}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Verificação Pós-Checkout (fallback para quando o webhook atrasa)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Chamado pelo frontend na página de retorno do checkout MP.
   * Verifica diretamente na API do MP se o pagamento foi aprovado e ativa a
   * assinatura imediatamente, sem depender do webhook ter chegado antes.
   *
   * Resolve condições de corrida onde o usuário retorna ao app antes
   * do webhook ser processado.
   */
  async verifyAndActivateFromPayment(
    userId: string,
    paymentId: string,
  ): Promise<{ activated: boolean; alreadyActive?: boolean; status?: string; expiresAt?: Date }> {
    if (!paymentId) {
      throw new BadRequestException('payment_id é obrigatório');
    }

    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');

    this.logger.log(
      `[verifyAndActivate] Verificando paymentId=${paymentId} para userId=${userId}`,
    );

    let mpPayment: any;
    try {
      mpPayment = await this.mercadoPagoService.getPayment(paymentId);
    } catch (err) {
      this.logger.error(
        `[verifyAndActivate] Erro ao consultar MP: paymentId=${paymentId}`,
        err,
      );
      throw new BadRequestException(
        'Não foi possível verificar o pagamento no Mercado Pago. Tente novamente.',
      );
    }

    this.logger.log(
      `[verifyAndActivate] MP status=${mpPayment.status} ` +
        `metadata=${JSON.stringify(mpPayment.metadata)}`,
    );

    // Verificar se o pagamento pertence a uma assinatura
    const isSubscription =
      mpPayment.metadata?.is_subscription === true ||
      mpPayment.metadata?.is_subscription === 'true';

    if (!isSubscription) {
      throw new BadRequestException(
        'Este pagamento não corresponde a uma assinatura de mensalidade.',
      );
    }

    // Status ainda pendente — só informa, não ativa
    if (mpPayment.status !== 'approved') {
      this.logger.log(
        `[verifyAndActivate] Pagamento não aprovado: status=${mpPayment.status}`,
      );
      return { activated: false, status: mpPayment.status };
    }

    // Idempotência: se já está ativo com o mesmo paymentId, não precisa fazer nada
    if (
      (profile as any).mpSubscriptionId === paymentId &&
      (profile as any).subscriptionStatus === 'ACTIVE'
    ) {
      this.logger.log(
        `[verifyAndActivate] Assinatura já ativa para paymentId=${paymentId} (idempotência)`,
      );
      return { activated: true, alreadyActive: true };
    }

    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + 1);

    await this.prisma.professionalProfile.update({
      where: { id: profile.id },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionExpiresAt: expDate,
        mpSubscriptionId: paymentId,
      } as any,
    });

    this.logger.log(
      `✅ [verifyAndActivate] Assinatura ativada via verify-payment: ` +
        `userId=${userId} profileId=${profile.id} expires=${expDate.toISOString()}`,
    );

    return { activated: true, expiresAt: expDate };
  }
}
