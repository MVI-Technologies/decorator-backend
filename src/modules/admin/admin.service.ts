import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfessionalStatusDto, ProcessWithdrawalDto } from './dto';

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
   * Retorna métricas gerais da plataforma.
   */
  async getDashboard() {
    const [
      totalUsers,
      totalClients,
      totalProfessionals,
      pendingApprovals,
      activeProjects,
      completedProjects,
      pendingWithdrawals,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'CLIENT' } }),
      this.prisma.user.count({ where: { role: 'PROFESSIONAL' } }),
      this.prisma.professionalProfile.count({ where: { status: 'PENDING_APPROVAL' } }),
      this.prisma.project.count({ where: { status: { in: ['IN_PROGRESS', 'DELIVERED', 'REVISION_REQUESTED'] } } }),
      this.prisma.project.count({ where: { status: 'COMPLETED' } }),
      this.prisma.withdrawal.count({ where: { status: 'REQUESTED' } }),
      this.prisma.payment.aggregate({ where: { status: 'RELEASED' }, _sum: { platformFee: true } }),
    ]);

    return {
      users: { total: totalUsers, clients: totalClients, professionals: totalProfessionals },
      professionals: { pendingApprovals },
      projects: { active: activeProjects, completed: completedProjects },
      finance: {
        totalPlatformRevenue: totalRevenue._sum.platformFee || 0,
        pendingWithdrawals,
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
}
