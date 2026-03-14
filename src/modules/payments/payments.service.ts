import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MercadoPagoService } from './mercadopago.service';
import { RequestWithdrawalDto } from './dto';

const CONFIG_ADMIN_PIX_KEY = 'ADMIN_PIX_KEY';
const CONFIG_ADMIN_PIX_KEY_TYPE = 'ADMIN_PIX_KEY_TYPE';

/**
 * Service de Pagamentos e Saques.
 * Gerencia consulta de saldo, saques e processamento de webhooks do Mercado Pago.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPagoService: MercadoPagoService,
  ) {}

  /**
   * Calcula o saldo disponível do profissional.
   * Saldo = pagamentos liberados - saques processados.
   */
  async getBalance(userId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil profissional não encontrado');
    }

    const paymentsResult = await this.prisma.payment.aggregate({
      where: {
        project: { professionalProfileId: profile.id },
        status: 'RELEASED',
      },
      _sum: { professionalAmount: true },
    });

    const withdrawalsResult = await this.prisma.withdrawal.aggregate({
      where: {
        professionalProfileId: profile.id,
        status: { in: ['COMPLETED', 'PROCESSING'] },
      },
      _sum: { amount: true },
    });

    const totalEarned = paymentsResult._sum.professionalAmount || 0;
    const totalWithdrawn = withdrawalsResult._sum.amount || 0;
    const availableBalance = totalEarned - totalWithdrawn;

    return {
      totalEarned,
      totalWithdrawn,
      availableBalance: Math.max(0, availableBalance),
      pendingWithdrawals: await this.prisma.withdrawal.count({
        where: {
          professionalProfileId: profile.id,
          status: { in: ['REQUESTED', 'PROCESSING'] },
        },
      }),
    };
  }

  /**
   * Solicita um saque.
   */
  async requestWithdrawal(userId: string, dto: RequestWithdrawalDto) {
    const balance = await this.getBalance(userId);

    if (dto.amount > balance.availableBalance) {
      throw new BadRequestException(
        `Saldo insuficiente. Disponível: R$${balance.availableBalance.toFixed(2)}`,
      );
    }

    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil profissional não encontrado');
    }

    if (!profile.pixKey && !profile.bankAccount) {
      throw new BadRequestException(
        'Cadastre seus dados bancários ou chave PIX antes de solicitar saque',
      );
    }

    const withdrawal = await this.prisma.withdrawal.create({
      data: {
        professionalProfileId: profile.id,
        amount: dto.amount,
      },
    });

    this.logger.log(`Saque solicitado: R$${dto.amount} por profissional ${profile.id}`);
    return withdrawal;
  }

  /**
   * Dados PIX para o cliente gerar o QR code de pagamento (MVP legado).
   */
  async getPixInfoForProject(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { payment: true, client: true },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado');
    if (project.clientId !== userId) {
      throw new ForbiddenException('Sem permissão para acessar este pagamento');
    }
    if (!project.payment) throw new NotFoundException('Pagamento não encontrado');
    if (project.payment.status !== 'PENDING') {
      throw new BadRequestException(
        'Este pagamento não está aguardando pagamento PIX (status: ' +
          project.payment.status +
          ')',
      );
    }

    const [pixKeyConfig, pixKeyTypeConfig] = await Promise.all([
      this.prisma.systemConfig.findUnique({ where: { key: CONFIG_ADMIN_PIX_KEY } }),
      this.prisma.systemConfig.findUnique({ where: { key: CONFIG_ADMIN_PIX_KEY_TYPE } }),
    ]);

    const pixKey = pixKeyConfig?.value;
    const pixKeyType = pixKeyTypeConfig?.value ?? 'RANDOM';

    if (!pixKey) {
      throw new BadRequestException(
        'Chave PIX do sistema ainda não foi configurada pelo admin. Entre em contato.',
      );
    }

    return {
      pixKey,
      pixKeyType,
      amount: project.payment.amount,
      description: `Decorador.net - Projeto ${project.title}`,
      projectId: project.id,
      paymentId: project.payment.id,
    };
  }

  /**
   * Lista histórico de saques do profissional.
   */
  async getWithdrawalHistory(userId: string, page = 1, limit = 10) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil profissional não encontrado');
    }

    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where: { professionalProfileId: profile.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.withdrawal.count({
        where: { professionalProfileId: profile.id },
      }),
    ]);

    return {
      data: withdrawals,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Webhook Mercado Pago
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Processa a confirmação de pagamento recebida via webhook do Mercado Pago.
   *
   * Fluxo:
   * 1. Consulta o pagamento real na API do MP (nunca confiar só no payload do webhook)
   * 2. Localiza o projeto via external_reference
   * 3. Idempotência: se paymentId já processado como 'approved', ignora
   * 4. Se aprovado: projeto → IN_PROGRESS + salva dados do pagamento
   * 5. Notifica cliente e profissional
   *
   * A validação HMAC é feita no Controller antes de chamar este método.
   */
  async handleMercadoPagoPayment(paymentId: string) {
    this.logger.log(`Processando pagamento MP: id=${paymentId}`);

    // 1. Consultar status real na API do MP
    let mpPayment: Awaited<ReturnType<MercadoPagoService['getPayment']>>;
    try {
      mpPayment = await this.mercadoPagoService.getPayment(paymentId);
    } catch (err) {
      this.logger.error(`Falha ao consultar pagamento ${paymentId} na API do MP`, err);
      return; // Não relançar — MP reenviaria o webhook infinitamente
    }

    const projectId = mpPayment.external_reference;
    if (!projectId) {
      this.logger.warn(`Webhook MP sem external_reference: paymentId=${paymentId}`);
      return;
    }

    // 2. Buscar o projeto
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      this.logger.warn(`Projeto não encontrado: ${projectId}`);
      return;
    }

    // 3. Idempotência (cast para any porque campos novos ainda não estão no Prisma Client)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proj = project as any;
    if (proj.paymentId === paymentId && proj.paymentStatus === 'approved') {
      this.logger.log(`Webhook duplicado ignorado: paymentId=${paymentId}`);
      return;
    }

    // 4. Montar dados a salvar
    const updateData: Record<string, unknown> = {
      paymentId,
      paymentStatus: mpPayment.status,
      paymentMethod: mpPayment.payment_method_id,
      installments: mpPayment.installments,
      transactionAmount: mpPayment.transaction_amount,
    };

    if (mpPayment.status === 'approved') {
      updateData.status = 'IN_PROGRESS';
      updateData.startedAt = new Date();
      this.logger.log(
        `Projeto ${projectId} → IN_PROGRESS | paymentId=${paymentId} ` +
          `método=${mpPayment.payment_method_id} valor=R$${mpPayment.transaction_amount}`,
      );
    } else {
      this.logger.log(
        `Pagamento ${paymentId} status=${mpPayment.status} (projeto=${projectId})`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.prisma.$transaction(async (tx) => {
      // 5. Atualizar Projeto
      await tx.project.update({ where: { id: projectId }, data: updateData as any });

      // 6. Criar Registro de Repasse (Payment/Escrow) se aprovado
      if (mpPayment.status === 'approved') {
        const configRate = await tx.systemConfig.findUnique({
          where: { key: 'PLATFORM_FEE_PERCENTAGE' },
        });
        const pct = configRate ? parseFloat(configRate.value) : 15; // default 15%
        const feeMultiplier = pct / 100;
        
        const totalAmount = mpPayment.transaction_amount || (project.price ?? 0);
        const platformFee = totalAmount * feeMultiplier;
        const professionalAmount = totalAmount - platformFee;

        // Limpa se tiver resíduos de MVP anterior
        await tx.payment.deleteMany({ where: { projectId } });

        await tx.payment.create({
          data: {
            projectId,
            amount: totalAmount,
            platformFee,
            professionalAmount,
            status: 'IN_ESCROW', // Será RELEASED quando o projeto for finalizado (COMPLETED)
          },
        });
      }
    });

    // 7. Notificações
    if (mpPayment.status === 'approved') {
      try {
        await this.prisma.notification.create({
          data: {
            userId: project.clientId,
            type: 'PAYMENT',
            title: 'Pagamento confirmado!',
            message: `O pagamento do projeto "${project.title}" foi aprovado. O decorador já pode começar!`,
            data: { projectId, paymentId },
          },
        });

        // Notificar profissional selecionado
        const selectedProfId = proj.selectedProfessionalId as string | null;
        if (selectedProfId) {
          const profProfile = await this.prisma.professionalProfile.findUnique({
            where: { id: selectedProfId },
            select: { userId: true },
          });
          if (profProfile?.userId) {
            await this.prisma.notification.create({
              data: {
                userId: profProfile.userId,
                type: 'PAYMENT',
                title: 'Projeto confirmado!',
                message: `O pagamento do projeto "${project.title}" foi aprovado. Você já pode começar!`,
                data: { projectId, paymentId },
              },
            });
          }
        }
      } catch (notifErr) {
        this.logger.error('Erro ao criar notificação pós-pagamento', notifErr);
      }
    }
  }
}
