import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignProfessionalDto, RequestProposalDto, RequestRevisionDto } from './dto';
import { ConfigService } from '@nestjs/config';

/**
 * Service de Projetos.
 * Gerencia o ciclo completo do projeto do ponto de vista do cliente:
 * listagem, matching, contratação, acompanhamento, aprovação e revisões.
 */
@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);
  private readonly platformFeeRate: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.platformFeeRate = parseFloat(
      this.configService.get<string>('ESCROW_COMMISSION_RATE', '0.15'),
    );
  }

  /**
   * Lista todos os projetos do cliente com paginação.
   */
  async findAllByClient(clientId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where: { clientId },
        include: {
          briefing: true,
          professionalProfile: {
            include: { user: { select: { name: true, avatarUrl: true } } },
          },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project.count({ where: { clientId } }),
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

  /**
   * Detalhes de um projeto com todas as relações.
   */
  async findOne(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        briefing: true,
        professionalProfile: {
          include: {
            user: { select: { name: true, avatarUrl: true, email: true } },
            styles: true,
          },
        },
        payment: true,
        review: true,
        files: { orderBy: { createdAt: 'desc' } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    // Verificar acesso
    const isClient = project.clientId === userId;
    const isProfessional = project.professionalProfile?.userId === userId;

    if (!isClient && !isProfessional) {
      throw new ForbiddenException('Sem permissão para acessar este projeto');
    }

    return project;
  }

  /**
   * Busca profissionais compatíveis com os estilos do briefing.
   */
  async matchProfessionals(projectId: string, clientId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { briefing: true },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    if (project.clientId !== clientId) {
      throw new ForbiddenException('Sem permissão');
    }

    let stylePreferences = project.briefing?.stylePreferences || [];
    // "Sem estilos" ou array vazio = mostrar todos os profissionais (não filtrar por estilo)
    const noStyleSentinel = 'sem estilos';
    stylePreferences = stylePreferences.filter(
      (s) => s && String(s).trim().toLowerCase() !== noStyleSentinel,
    );

    // Buscar profissionais aprovados, com match por estilo (ou todos se sem preferência)
    const professionals = await this.prisma.professionalProfile.findMany({
      where: {
        status: 'APPROVED',
        ...(stylePreferences.length > 0 && {
          styles: {
            some: {
              name: { in: stylePreferences, mode: 'insensitive' },
            },
          },
        }),
      },
      include: {
        user: { select: { name: true, avatarUrl: true } },
        styles: true,
        portfolioItems: {
          take: 4,
          orderBy: { order: 'asc' },
        },
      },
      orderBy: [
        { averageRating: 'desc' },
        { completedProjects: 'desc' },
      ],
    });

    return professionals;
  }

  /**
   * Inicia conversa com um profissional (solicitar proposta).
   * Coloca o projeto em NEGOCIANDO, vincula o profissional e opcionalmente envia mensagem inicial.
   */
  async requestProposal(projectId: string, clientId: string, dto: RequestProposalDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { briefing: true },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    if (project.clientId !== clientId) {
      throw new ForbiddenException('Sem permissão para este projeto');
    }

    const allowedStatuses = ['BRIEFING_SUBMITTED', 'MATCHING'];
    if (!allowedStatuses.includes(project.status)) {
      throw new BadRequestException(
        'Só é possível iniciar conversa enquanto o projeto está em briefing ou matching',
      );
    }

    const professional = await this.prisma.professionalProfile.findUnique({
      where: { id: dto.professionalProfileId },
    });

    if (!professional || professional.status !== 'APPROVED') {
      throw new BadRequestException('Profissional não encontrado ou não aprovado');
    }

    const content =
      (dto.initialMessage && dto.initialMessage.trim()) ||
      'Olá! Iniciei uma conversa sobre este projeto. O briefing completo está disponível.';

    const [updatedProject] = await this.prisma.$transaction([
      this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'NEGOCIANDO',
          professionalProfileId: dto.professionalProfileId,
        },
        include: {
          briefing: true,
          professionalProfile: {
            include: { user: { select: { name: true, avatarUrl: true, email: true } } },
          },
        },
      }),
      this.prisma.message.create({
        data: {
          projectId,
          senderId: clientId,
          content,
        },
      }),
    ]);

    this.logger.log(
      `Conversa iniciada: projeto ${projectId} com profissional ${dto.professionalProfileId}`,
    );
    return updatedProject;
  }

  /**
   * Atribui um profissional ao projeto e cria o pagamento (escrow).
   */
  async assignProfessional(projectId: string, clientId: string, dto: AssignProfessionalDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    if (project.clientId !== clientId) {
      throw new ForbiddenException('Sem permissão');
    }

    if (project.professionalProfileId) {
      throw new BadRequestException('Este projeto já possui um profissional atribuído');
    }

    // Verificar se o profissional existe e está aprovado
    const professional = await this.prisma.professionalProfile.findUnique({
      where: { id: dto.professionalProfileId },
    });

    if (!professional || professional.status !== 'APPROVED') {
      throw new BadRequestException('Profissional não encontrado ou não aprovado');
    }

    // Calcular taxas
    const platformFee = Math.round(dto.price * this.platformFeeRate * 100) / 100;
    const professionalAmount = Math.round((dto.price - platformFee) * 100) / 100;

    // Transação: atualizar projeto + criar payment
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: {
          professionalProfileId: dto.professionalProfileId,
          packageType: dto.packageType,
          price: dto.price,
          status: 'PROFESSIONAL_ASSIGNED',
        },
      });

      // MVP: pagamento inicia PENDING — cliente paga via PIX (QR) para o admin; admin marca "recebido" → IN_ESCROW; em até 4 dias admin paga o profissional e marca → RELEASED
      const payment = await tx.payment.create({
        data: {
          projectId,
          amount: dto.price,
          platformFee,
          professionalAmount,
          status: 'PENDING',
        },
      });

      return { project: updatedProject, payment };
    });

    this.logger.log(
      `Profissional ${dto.professionalProfileId} atribuído ao projeto ${projectId}. ` +
      `Valor: R$${dto.price} | Taxa: R$${result.payment.platformFee} | ` +
      `Profissional: R$${result.payment.professionalAmount}`,
    );

    return result;
  }

  /**
   * Aprova a entrega do projeto e libera o escrow.
   */
  async approveDelivery(projectId: string, clientId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { payment: true, professionalProfile: true },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    if (project.clientId !== clientId) {
      throw new ForbiddenException('Sem permissão');
    }

    if (project.status !== 'DELIVERED') {
      throw new BadRequestException(
        'Só é possível aprovar projetos com status DELIVERED',
      );
    }

    // MVP: aprovar entrega só marca projeto como COMPLETED; o pagamento ao profissional é feito pelo admin em até 4 dias úteis (mark-paid-to-professional).
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      if (project.professionalProfileId) {
        await tx.professionalProfile.update({
          where: { id: project.professionalProfileId },
          data: { completedProjects: { increment: 1 } },
        });
      }

      return { project: updatedProject, payment: project.payment };
    });

    this.logger.log(`Projeto ${projectId} aprovado pelo cliente.`);
    return result;
  }

  /**
   * Solicita revisão de um projeto entregue.
   */
  async requestRevision(projectId: string, clientId: string, dto: RequestRevisionDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    if (project.clientId !== clientId) {
      throw new ForbiddenException('Sem permissão');
    }

    if (project.status !== 'DELIVERED') {
      throw new BadRequestException('Só é possível solicitar revisão de projetos entregues');
    }

    if (project.revisionsUsed >= project.maxRevisions) {
      throw new BadRequestException(
        `Limite de revisões atingido (${project.maxRevisions}/${project.maxRevisions})`,
      );
    }

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'REVISION_REQUESTED',
        revisionsUsed: { increment: 1 },
      },
    });

    // Se há comentário, criar mensagem no chat
    if (dto.comment) {
      await this.prisma.message.create({
        data: {
          projectId,
          senderId: clientId,
          content: `📝 Revisão solicitada: ${dto.comment}`,
        },
      });
    }

    this.logger.log(
      `Revisão solicitada para projeto ${projectId} ` +
      `(${updatedProject.revisionsUsed}/${updatedProject.maxRevisions})`,
    );

    return updatedProject;
  }
}
