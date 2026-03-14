import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UpdateProfessionalStatusDto,
  ProcessWithdrawalDto,
  UpdateAdminPixDto,
} from './dto';

const CONFIG_ADMIN_PIX_KEY = 'ADMIN_PIX_KEY';
const CONFIG_ADMIN_PIX_KEY_TYPE = 'ADMIN_PIX_KEY_TYPE';
const CONFIG_PROFESSIONAL_MONTHLY_FEE = 'PROFESSIONAL_MONTHLY_FEE';
const CONFIG_PLATFORM_FEE_PERCENTAGE = 'PLATFORM_FEE_PERCENTAGE';

/**
 * Service Admin.
 * Gerencia aprovações de profissionais, saques e dashboard.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── DASHBOARD ────────────────────────────────────────

  /**
   * Retorna métricas gerais da plataforma (para os cards do dashboard).
   */
  async getDashboard() {
    const [
      totalUsers,
      totalClients,
      totalProfessionals,
      pendingApprovals,
      totalProjects,
      activeProjects,
      completedProjects,
      pendingWithdrawals,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'CLIENT' } }),
      this.prisma.user.count({ where: { role: 'PROFESSIONAL' } }),
      this.prisma.professionalProfile.count({ where: { status: 'PENDING_APPROVAL' } }),
      this.prisma.project.count(),
      this.prisma.project.count({ where: { status: { in: ['IN_PROGRESS', 'DELIVERED', 'REVISION_REQUESTED'] } } }),
      this.prisma.project.count({ where: { status: 'COMPLETED' } }),
      this.prisma.withdrawal.count({ where: { status: 'REQUESTED' } }),
      this.prisma.payment.aggregate({ where: { status: 'RELEASED' }, _sum: { platformFee: true } }),
    ]);

    return {
      users: { total: totalUsers, clients: totalClients, professionals: totalProfessionals },
      professionals: { pendingApprovals },
      projects: {
        total: totalProjects,
        active: activeProjects,
        completed: completedProjects,
      },
      finance: {
        totalPlatformRevenue: totalRevenue._sum.platformFee || 0,
        pendingWithdrawals,
      },
    };
  }

  /**
   * Lista todos os projetos (admin). Retorna projeto, cliente, profissional e status do pagamento.
   */
  async getProjects(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: { id: true, name: true, email: true },
          },
          professionalProfile: {
            select: {
              id: true,
              displayName: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
          payment: {
            select: {
              id: true,
              status: true,
              amount: true,
              platformFee: true,
              professionalAmount: true,
              createdAt: true,
              escrowStartedAt: true,
              releasedAt: true,
            },
          },
        },
      }),
      this.prisma.project.count(),
    ]);

    return {
      data: projects,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── PROFISSIONAIS ────────────────────────────────────

  /**
   * Lista profissionais pendentes de aprovação.
   */
  async getPendingProfessionals() {
    return this.prisma.professionalProfile.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: {
        user: { select: { name: true, email: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Atualiza status do profissional.
   */
  async updateProfessionalStatus(profileId: string, dto: UpdateProfessionalStatusDto) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new NotFoundException('Profissional não encontrado');
    }

    const updated = await this.prisma.professionalProfile.update({
      where: { id: profileId },
      data: { status: dto.action as any },
    });

    this.logger.log(`Profissional ${profileId} → ${dto.action} (${dto.reason || 'sem motivo'})`);
    return updated;
  }

  // ─── SAQUES ────────────────────────────────────────

  /**
   * Lista saques pendentes.
   */
  async getPendingWithdrawals() {
    return this.prisma.withdrawal.findMany({
      where: { status: 'REQUESTED' },
      include: {
        professionalProfile: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Processa saque (aprovar ou rejeitar).
   */
  async processWithdrawal(withdrawalId: string, dto: ProcessWithdrawalDto) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Saque não encontrado');
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: dto.action as any,
        adminNotes: dto.adminNotes,
        processedAt: new Date(),
      },
    });

    this.logger.log(`Saque ${withdrawalId} → ${dto.action}`);
    return updated;
  }

  // ─── USUÁRIOS ────────────────────────────────────────

  /**
   * Lista todos os usuários (paginado).
   */
  async getUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Desativar/ativar usuário (soft delete).
   */
  async toggleUserActive(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });
  }

  // ─── CHAVE PIX DO ADMIN (MVP) ────────────────────────────────────────

  /**
   * Retorna a chave PIX configurada do admin (para gerar QR code de pagamento).
   */
  async getAdminPixSettings() {
    const [pixKey, pixKeyType] = await Promise.all([
      this.prisma.systemConfig.findUnique({ where: { key: CONFIG_ADMIN_PIX_KEY } }),
      this.prisma.systemConfig.findUnique({
        where: { key: CONFIG_ADMIN_PIX_KEY_TYPE },
      }),
    ]);
    return {
      pixKey: pixKey?.value ?? null,
      pixKeyType: pixKeyType?.value ?? null,
    };
  }

  /**
   * Atualiza a chave PIX do admin (recebimento de pagamentos do cliente via PIX).
   */
  async updateAdminPixSettings(dto: UpdateAdminPixDto) {
    await this.prisma.$transaction([
      this.prisma.systemConfig.upsert({
        where: { key: CONFIG_ADMIN_PIX_KEY },
        create: { key: CONFIG_ADMIN_PIX_KEY, value: dto.pixKey },
        update: { value: dto.pixKey },
      }),
      this.prisma.systemConfig.upsert({
        where: { key: CONFIG_ADMIN_PIX_KEY_TYPE },
        create: { key: CONFIG_ADMIN_PIX_KEY_TYPE, value: dto.pixKeyType },
        update: { value: dto.pixKeyType },
      }),
    ]);
    this.logger.log('Chave PIX do admin atualizada');
    return this.getAdminPixSettings();
  }

  // ─── CONFIGURAÇÕES DA PLATAFORMA (TAXAS E MENSALIDADES) ───────────────────

  /**
   * Retorna as configurações de negócio e taxas da plataforma
   */
  async getPlatformConfigs() {
    const [monthlyFee, platformFee] = await Promise.all([
      this.prisma.systemConfig.findUnique({ where: { key: CONFIG_PROFESSIONAL_MONTHLY_FEE } }),
      this.prisma.systemConfig.findUnique({ where: { key: CONFIG_PLATFORM_FEE_PERCENTAGE } }),
    ]);

    return {
      professionalMonthlyFee: monthlyFee?.value ? parseFloat(monthlyFee.value) : 21.90,
      platformFeePercentage: platformFee?.value ? parseFloat(platformFee.value) : 15,
    };
  }

  /**
   * Atualiza as configurações de negócio da plataforma
   */
  async updatePlatformConfigs(dto: { professionalMonthlyFee?: number; platformFeePercentage?: number }) {
    const transactions = [];

    if (dto.professionalMonthlyFee !== undefined) {
      transactions.push(
        this.prisma.systemConfig.upsert({
          where: { key: CONFIG_PROFESSIONAL_MONTHLY_FEE },
          create: { key: CONFIG_PROFESSIONAL_MONTHLY_FEE, value: dto.professionalMonthlyFee.toString() },
          update: { value: dto.professionalMonthlyFee.toString() },
        })
      );
    }

    if (dto.platformFeePercentage !== undefined) {
      transactions.push(
        this.prisma.systemConfig.upsert({
          where: { key: CONFIG_PLATFORM_FEE_PERCENTAGE },
          create: { key: CONFIG_PLATFORM_FEE_PERCENTAGE, value: dto.platformFeePercentage.toString() },
          update: { value: dto.platformFeePercentage.toString() },
        })
      );
    }

    if (transactions.length > 0) {
      await this.prisma.$transaction(transactions);
      this.logger.log('Configurações de taxas da plataforma atualizadas pelo Admin');
    }

    return this.getPlatformConfigs();
  }

  // ─── PAGAMENTOS MVP (cliente paga PIX → admin recebe → em 4 dias paga profissional) ───

  /**
   * Lista pagamentos aguardando confirmação de recebimento (cliente já pagou via PIX; admin marca "recebido").
   */
  async getPaymentsPendingReceived() {
    return this.prisma.payment.findMany({
      where: { status: 'PENDING' },
      include: {
        project: {
          include: {
            client: { select: { name: true, email: true } },
            professionalProfile: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin marca que recebeu o pagamento PIX do cliente (PENDING → IN_ESCROW).
   * Projeto → IN_PROGRESS (profissional pode entregar a partir daí).
   */
  async markPaymentReceived(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { project: true },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    if (payment.status !== 'PENDING') {
      throw new BadRequestException(
        'Só é possível marcar recebimento em pagamentos com status PENDING',
      );
    }
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'IN_ESCROW',
          escrowStartedAt: new Date(),
        },
      }),
      this.prisma.project.update({
        where: { id: payment.projectId },
        data: { status: 'IN_PROGRESS' },
      }),
    ]);
    this.logger.log(`Pagamento ${paymentId} recebido; projeto ${payment.projectId} → IN_PROGRESS`);
    return this.prisma.payment.findUnique({ where: { id: paymentId } });
  }

  /**
   * Lista pagamentos já recebidos pelo admin que ainda não foram repassados ao profissional (em até 4 dias úteis).
   * Retorna valor total do projeto, valor a repassar (já descontados 15%), nome do cliente, do profissional e chave PIX.
   */
  async getPaymentsPendingTransferToProfessional() {
    const payments = await this.prisma.payment.findMany({
      where: { status: 'IN_ESCROW' },
      include: {
        project: {
          include: {
            client: { select: { name: true } },
            professionalProfile: {
              select: {
                id: true,
                pixKey: true,
                user: { select: { name: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { escrowStartedAt: 'asc' },
    });

    return payments.map((p) => ({
      id: p.id,
      projectId: p.projectId,
      projectTitle: p.project.title,
      clientName: p.project.client.name,
      professionalName: p.project.professionalProfile?.user.name ?? null,
      professionalPixKey: p.project.professionalProfile?.pixKey ?? null,
      totalAmount: p.amount,
      platformFee: p.platformFee,
      amountToTransfer: p.professionalAmount,
      escrowStartedAt: p.escrowStartedAt,
    }));
  }

  /**
   * Admin marca que já repassou o valor ao profissional (IN_ESCROW → RELEASED).
   */
  async markPaymentPaidToProfessional(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { project: true },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    if (payment.status !== 'IN_ESCROW') {
      throw new BadRequestException(
        'Só é possível marcar como pago em pagamentos com status IN_ESCROW',
      );
    }
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
    this.logger.log(`Pagamento ${paymentId} repassado ao profissional`);
    return updated;
  }
}
