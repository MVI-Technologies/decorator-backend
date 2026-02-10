import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestWithdrawalDto } from './dto';

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
