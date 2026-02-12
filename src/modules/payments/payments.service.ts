import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestWithdrawalDto } from './dto';

const CONFIG_ADMIN_PIX_KEY = 'ADMIN_PIX_KEY';
const CONFIG_ADMIN_PIX_KEY_TYPE = 'ADMIN_PIX_KEY_TYPE';

/**
 * Service de Pagamentos e Saques.
 * Gerencia consulta de saldo e solicitações de saque do profissional.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    // Total acumulado de pagamentos liberados
    const paymentsResult = await this.prisma.payment.aggregate({
      where: {
        project: { professionalProfileId: profile.id },
        status: 'RELEASED',
      },
      _sum: { professionalAmount: true },
    });

    // Total de saques aprovados/processados
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

    // Verificar dados bancários
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

    this.logger.log(
      `Saque solicitado: R$${dto.amount} por profissional ${profile.id}`,
    );

    return withdrawal;
  }

  /**
   * Dados PIX para o cliente gerar o QR code de pagamento (MVP).
   * Apenas para o cliente dono do projeto; pagamento deve estar PENDING.
   * O valor cai na chave PIX do admin; em até 4 dias úteis o admin repassa ao profissional.
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
      this.prisma.systemConfig.findUnique({
        where: { key: CONFIG_ADMIN_PIX_KEY },
      }),
      this.prisma.systemConfig.findUnique({
        where: { key: CONFIG_ADMIN_PIX_KEY_TYPE },
      }),
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
}
