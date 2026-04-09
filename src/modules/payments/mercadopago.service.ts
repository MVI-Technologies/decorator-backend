import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MercadoPagoConfig, {
  Preference,
  Payment,
  PreApprovalPlan,
  PreApproval,
} from 'mercadopago';
import * as crypto from 'crypto';

export interface CreatePreferenceParams {
  projectId: string; // Pode ser o ID do perfil no caso de assinatura
  projectTitle: string;
  price: number;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  installmentsLimit?: number;
  isSubscription?: boolean;
}

export interface PreferenceResult {
  preferenceId: string;
  checkoutUrl: string;
}

/**
 * Service responsável por toda interação com a API do Mercado Pago.
 * Centraliza: criação de preferência, consulta de pagamento e validação de webhook.
 */
@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly preference: Preference;
  private readonly payment: Payment;
  private readonly preApprovalPlan: PreApprovalPlan;
  private readonly preApproval: PreApproval;
  private readonly frontendUrl: string;
  private readonly webhookSecret: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const accessToken = configService.getOrThrow<string>(
      'MERCADOPAGO_ACCESS_TOKEN',
    );
    this.frontendUrl = configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:8080',
    );
    this.webhookSecret = configService.get<string>(
      'MERCADOPAGO_WEBHOOK_SECRET',
    );

    const client = new MercadoPagoConfig({ accessToken });
    this.preference = new Preference(client);
    this.payment = new Payment(client);
    this.preApprovalPlan = new PreApprovalPlan(client);
    this.preApproval = new PreApproval(client);
  }


  /**
   * Cria uma preferência de pagamento no Mercado Pago.
   * Aceita PIX, cartão de débito e cartão de crédito (até 12 parcelas).
   * Define back_urls e notification_url para integração completa.
   */
  async createPreference(params: CreatePreferenceParams): Promise<PreferenceResult> {
    const {
      projectId,
      projectTitle,
      price,
      clientName,
      clientEmail,
      clientPhone,
    } = params;

    const backendUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    const notificationUrl = `${backendUrl}/api/v1/payments/webhook/mercadopago`;

    this.logger.log(
      `Criando preferência MP: projeto=${projectId} valor=R$${price} payer=${clientEmail}`,
    );

    const response = await this.preference.create({
      body: {
        items: [
          {
            id: projectId,
            title: `Decornet - ${projectTitle}`,
            description: `Projeto de design de interiores: ${projectTitle}`,
            quantity: 1,
            unit_price: Number(price),
            currency_id: 'BRL',
          },
        ],
        payer: {
          name: clientName,
          email: clientEmail,
          ...(clientPhone && {
            phone: { area_code: '', number: clientPhone },
          }),
        },
        payment_methods: {
          // Permite todos os métodos: PIX, débito e crédito
          excluded_payment_types: [],
          // Máximo de parcelas para cartão de crédito (vinda das configs do admin, default 12)
          installments: params.installmentsLimit ?? 12,
          // Parcelas sem acréscimo (definido pela loja/conta MP)
          default_installments: 1,
        },
        notification_url: notificationUrl,
        back_urls: {
          success: params.isSubscription
            ? `${this.frontendUrl}/app/configuracoes/assinatura?status=success&payment_id=PAYMENT_ID`
            : `${this.frontendUrl}/app/projetos/${projectId}/pagamento/sucesso`,
          failure: params.isSubscription
            ? `${this.frontendUrl}/app/configuracoes/assinatura?status=failure`
            : `${this.frontendUrl}/app/projetos/${projectId}/pagamento/falha`,
          pending: params.isSubscription
            ? `${this.frontendUrl}/app/configuracoes/assinatura?status=pending`
            : `${this.frontendUrl}/app/projetos/${projectId}/pagamento/pendente`,
        },
        // Redirecionar automaticamente após aprovação
        auto_return: 'approved',
        // Referência externa para correlacionar no webhook
        external_reference: projectId,
        // Link expira em 24 horas
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(),
        // Metadados adicionais
        metadata: {
          project_id: projectId,
          is_subscription: params.isSubscription ?? false,
        },
        // Identificação da plataforma
        statement_descriptor: 'DECORNET',
      },
    });

    this.logger.log(
      `Preferência MP criada: id=${response.id} url=${response.init_point}`,
    );

    const isSandbox = this.configService.get('MERCADOPAGO_ACCESS_TOKEN')?.startsWith('TEST-');

    return {
      preferenceId: response.id!,
      checkoutUrl: isSandbox ? (response as any).sandbox_init_point : response.init_point!,
    };
  }

  /**
   * Consulta o status real de um pagamento na API do MP.
   * SEMPRE usar este método para validar o webhook — nunca confiar só no payload.
   */
  async getPayment(paymentId: string) {
    this.logger.log(`Consultando pagamento MP: id=${paymentId}`);
    return this.payment.get({ id: paymentId });
  }

  // ─── Assinaturas Mês a Mês (PreApproval) ──────────────────────────────────

  /**
   * Cria um Plano de Assinatura Recorrente no Mercado Pago.
   */
  async createSubscriptionPlan(amount: number): Promise<{ planId: string; checkoutUrl: string }> {
    // O Mercado Pago rejeita back_url com localhost em contas reais.
    // Só incluímos a back_url se for uma URL pública válida.
    const isProductionUrl = (url: string) =>
      url.startsWith('https://') || (url.startsWith('http://') && !url.includes('localhost'));

    const body: Record<string, any> = {
      reason: 'Assinatura Decornet - Profissional',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: amount,
        currency_id: 'BRL',
      },
    };

    if (isProductionUrl(this.frontendUrl)) {
      body.back_url = `${this.frontendUrl}/app/configuracoes/assinatura`;
    } else {
      this.logger.warn(
        `FRONTEND_URL "${this.frontendUrl}" é localhost — omitindo back_url do plano MP (OK para testes).`,
      );
    }

    const response = await this.preApprovalPlan.create({ body });
    const checkoutUrl = response.init_point;

    this.logger.log(`Plano de assinatura MP criado: id=${response.id} url=${checkoutUrl}`);

    if (!checkoutUrl) {
      throw new Error(`Plano MP criado sem url de checkout. ID: ${response.id}`);
    }

    return { planId: response.id!, checkoutUrl };
  }

  /**
   * Retorna o link de checkout de um plano de assinatura já criado.
   * O checkoutUrl vem direto do campo `init_point` retornado na criação do plano.
   */
  async createSubscriptionLink(checkoutUrl: string, _professionalId: string, _email: string) {
    return { checkoutUrl };
  }

  /**
   * Consulta uma assinatura existente.
   */
  async getSubscription(subscriptionId: string) {
    return this.preApproval.get({ id: subscriptionId });
  }


  /**
   * Valida a assinatura HMAC-SHA256 do webhook do Mercado Pago.
   * Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
   *
   * @returns true se válida ou se WEBHOOK_SECRET não estiver configurado (dev mode)
   */
  validateWebhookSignature(params: {
    xSignature: string | undefined;
    xRequestId: string | undefined;
    queryId: string | undefined;
  }): boolean {
    const { xSignature, xRequestId, queryId } = params;

    // Se não há secret configurado, aceitar (ambiente de dev/sandbox)
    if (!this.webhookSecret) {
      this.logger.warn(
        'MERCADOPAGO_WEBHOOK_SECRET não configurado — validação de assinatura desabilitada (dev mode)',
      );
      return true;
    }

    if (!xSignature) {
      this.logger.warn('Webhook MP recebido sem header x-signature');
      return false;
    }

    try {
      // Formato: ts=<timestamp>,v1=<assinatura>
      const parts = xSignature.split(',');
      const ts = parts.find((p) => p.startsWith('ts='))?.split('=')[1];
      const v1 = parts.find((p) => p.startsWith('v1='))?.split('=')[1];

      if (!ts || !v1) return false;

      // Monta o manifest conforme documentação do MP
      const manifest = `id:${queryId ?? ''};request-id:${xRequestId ?? ''};ts:${ts};`;

      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(manifest)
        .digest('hex');

      const isValid = expected === v1;
      if (!isValid) {
        this.logger.warn(
          `Assinatura MP inválida. expected=${expected} received=${v1}`,
        );
      }
      return isValid;
    } catch (err) {
      this.logger.error('Erro ao validar assinatura MP', err);
      return false;
    }
  }
}
