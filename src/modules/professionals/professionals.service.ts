import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UpdateProfessionalProfileDto,
  CreatePortfolioItemDto,
  CreateStyleDto,
  DeliverProjectDto,
} from './dto';

/**
 * Service de Profissionais.
 * Gerencia perfil, portfólio, estilos, projetos atribuídos e entregas.
 */
@Injectable()
export class ProfessionalsService {
  private readonly logger = new Logger(ProfessionalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── PERFIL ────────────────────────────────────────────

  /**
   * Retorna perfil público do profissional.
   */
  async getPublicProfile(profileId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { id: profileId },
      include: {
        user: { select: { name: true, avatarUrl: true } },
        styles: true,
        portfolioItems: { orderBy: { order: 'asc' } },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profissional não encontrado');
    }

    const {
      cpfCnpj,
      documentUrl,
      bankName,
      bankAgency,
      bankAccount,
      pixKey,
      instagram,
      ...publicProfile
    } = profile;
    return publicProfile;
  }

  /**
   * Retorna perfil completo (para o próprio profissional).
   */
  async getOwnProfile(userId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { name: true, email: true, phone: true, avatarUrl: true } },
        styles: true,
        portfolioItems: { orderBy: { order: 'asc' } },
        withdrawals: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!profile) {
      throw new NotFoundException('Perfil profissional não encontrado');
    }

    return profile;
  }

  /**
   * Atualiza perfil do profissional.
   */
  async updateProfile(userId: string, dto: UpdateProfessionalProfileDto) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil profissional não encontrado');
    }

    return this.prisma.professionalProfile.update({
      where: { userId },
      data: dto,
    });
  }

  // ─── PORTFÓLIO ────────────────────────────────────────

  /**
   * Adiciona item ao portfólio.
   */
  async addPortfolioItem(userId: string, dto: CreatePortfolioItemDto) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil profissional não encontrado');
    }

    return this.prisma.portfolioItem.create({
      data: {
        professionalProfileId: profile.id,
        ...dto,
      },
    });
  }

  /**
   * Remove item do portfólio.
   */
  async removePortfolioItem(userId: string, itemId: string) {
    const item = await this.prisma.portfolioItem.findUnique({
      where: { id: itemId },
      include: { professionalProfile: true },
    });

    if (!item) {
      throw new NotFoundException('Item não encontrado');
    }

    if (item.professionalProfile.userId !== userId) {
      throw new ForbiddenException('Sem permissão');
    }

    return this.prisma.portfolioItem.delete({ where: { id: itemId } });
  }

  // ─── ESTILOS ────────────────────────────────────────

  /**
   * Lista estilos associados ao perfil do profissional (para o próprio profissional ver).
   */
  async getMyStyles(userId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      throw new NotFoundException('Perfil profissional não encontrado');
    }

    return this.prisma.professionalStyle.findMany({
      where: { professionalProfileId: profile.id },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Adiciona um estilo ao perfil.
   */
  async addStyle(userId: string, dto: CreateStyleDto) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil profissional não encontrado');
    }

    return this.prisma.professionalStyle.create({
      data: {
        professionalProfileId: profile.id,
        ...dto,
      },
    });
  }

  /**
   * Remove estilo do perfil.
   */
  async removeStyle(userId: string, styleId: string) {
    const style = await this.prisma.professionalStyle.findUnique({
      where: { id: styleId },
      include: { professionalProfile: true },
    });

    if (!style) {
      throw new NotFoundException('Estilo não encontrado');
    }

    if (style.professionalProfile.userId !== userId) {
      throw new ForbiddenException('Sem permissão');
    }

    return this.prisma.professionalStyle.delete({ where: { id: styleId } });
  }

  // ─── PROJETOS (LADO PROFISSIONAL) ────────────────────

  /**
   * Lista projetos atribuídos ao profissional.
   */
  async getMyProjects(userId: string, page = 1, limit = 10) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil profissional não encontrado');
    }

    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where: { professionalProfileId: profile.id },
        include: {
          briefing: true,
          client: { select: { name: true, avatarUrl: true } },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project.count({
        where: { professionalProfileId: profile.id },
      }),
    ]);

    return {
      data: projects,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Aceitar projeto atribuído (muda status para IN_PROGRESS).
   */
  async acceptProject(userId: string, projectId: string) {
    const project = await this.getProjectForProfessional(userId, projectId);

    if (project.status !== 'PROFESSIONAL_ASSIGNED') {
      throw new BadRequestException('Este projeto não está aguardando aceite');
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });
  }

  /**
   * Entregar projeto (muda status para DELIVERED).
   */
  async deliverProject(userId: string, projectId: string, dto: DeliverProjectDto) {
    const project = await this.getProjectForProfessional(userId, projectId);

    const deliverableStatuses = ['IN_PROGRESS', 'REVISION_REQUESTED'];
    if (!deliverableStatuses.includes(project.status)) {
      throw new BadRequestException('Este projeto não pode ser entregue no status atual');
    }

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'DELIVERED' },
    });

    // Se há mensagem de entrega, criar no chat
    if (dto.message) {
      await this.prisma.message.create({
        data: {
          projectId,
          senderId: userId,
          content: `📦 Entrega realizada: ${dto.message}`,
        },
      });
    }

    this.logger.log(`Projeto ${projectId} entregue pelo profissional`);
    return updatedProject;
  }

  /**
   * Helper: busca projeto verificando permissão do profissional.
   */
  private async getProjectForProfessional(userId: string, projectId: string) {
    const profile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil profissional não encontrado');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    if (project.professionalProfileId !== profile.id) {
      throw new ForbiddenException('Este projeto não está atribuído a você');
    }

    return project;
  }
}
