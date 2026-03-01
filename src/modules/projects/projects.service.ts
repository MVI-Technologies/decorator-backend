import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AssignProfessionalDto,
  RequestProposalDto,
  RequestRevisionDto,
  RespondProposalDto,
  SendProposalDto,
} from './dto';
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
   * Inclui proposals em cada projeto para a aba Propostas (pendente de aceite: status PENDING).
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
          proposals: {
            orderBy: { createdAt: 'desc' },
            include: {
              professionalProfile: {
                include: { user: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project.count({ where: { clientId } }),
    ]);

    const data = projects.map((project) => {
      const proposals = (project.proposals || []).map((p) => ({
        id: p.id,
        projectId: p.projectId,
        professionalProfileId: p.professionalProfileId,
        price: p.price,
        status: p.status,
        packageType: p.packageType,
        estimatedDays: p.estimatedDays,
        notes: p.notes,
        message: p.notes,
        createdAt: p.createdAt,
        professionalProfile: p.professionalProfile
          ? {
              displayName: p.professionalProfile.displayName,
              user: p.professionalProfile.user
                ? { name: p.professionalProfile.user.name }
                : undefined,
            }
          : undefined,
      }));
      const { proposals: _, ...rest } = project;
      return { ...rest, proposals };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Detalhes de um projeto com todas as relações, incluindo propostas (para o front mostrar card Aceitar/Recusar).
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
        proposals: {
          orderBy: { createdAt: 'desc' },
          include: {
            professionalProfile: {
              include: { user: { select: { name: true } } },
            },
          },
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

    // Normalizar propostas para o mesmo formato de GET /proposals/:projectId (status string, message alias de notes)
    const proposals = (project.proposals || []).map((p) => ({
      id: p.id,
      projectId: p.projectId,
      professionalProfileId: p.professionalProfileId,
      price: p.price,
      status: p.status,
      packageType: p.packageType,
      estimatedDays: p.estimatedDays,
      notes: p.notes,
      message: p.notes,
      createdAt: p.createdAt,
      professionalProfile: p.professionalProfile
        ? {
            displayName: p.professionalProfile.displayName,
            user: p.professionalProfile.user
              ? { name: p.professionalProfile.user.name }
              : undefined,
          }
        : undefined,
    }));

    return {
      ...project,
      proposals,
    };
  }

  /**
   * Cancela o projeto (soft delete): status → CANCELLED, sem apagar.
   * Apenas cliente dono, apenas status até NEGOCIANDO e sem proposta aceita.
   * Se houver profissional vinculado, envia notificação. Histórico (chat, propostas) permanece visível.
   */
  async deleteProject(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { professionalProfile: true },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    if (project.clientId !== userId) {
      throw new ForbiddenException('Apenas o dono do projeto pode cancelá-lo');
    }

    const allowedStatuses = ['BRIEFING_SUBMITTED', 'MATCHING', 'NEGOCIANDO'];
    if (!allowedStatuses.includes(project.status)) {
      throw new BadRequestException(
        'Só é possível cancelar o projeto enquanto estiver em briefing, matching ou negociação',
      );
    }

    const acceptedProposal = await this.prisma.proposal.findFirst({
      where: { projectId, status: 'ACCEPTED' },
    });
    if (acceptedProposal) {
      throw new BadRequestException(
        'Não é possível cancelar o projeto: já existe uma proposta aceita (projeto já contratado).',
      );
    }

    const professionalUserId = project.professionalProfile?.userId;

    await this.prisma.$transaction(async (tx) => {
      if (professionalUserId) {
        await tx.notification.create({
          data: {
            userId: professionalUserId,
            type: 'PROJECT_UPDATE',
            title: 'Projeto cancelado',
            message: `O projeto "${project.title}" foi cancelado pelo cliente.`,
            data: { projectId, projectTitle: project.title },
          },
        });
      }
      await tx.project.update({
        where: { id: projectId },
        data: { status: 'CANCELLED' },
      });
    });

    this.logger.log(`Projeto ${projectId} cancelado (soft delete); notificação enviada ao profissional.`);
    return { success: true, message: 'Projeto cancelado com sucesso.' };
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

    const text = (dto.message ?? dto.initialMessage ?? '').trim();
    const content =
      text || 'Olá! Iniciei uma conversa sobre este projeto. O briefing completo está disponível.';

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
   * Profissional envia proposta ao cliente.
   * Cria registro Proposal PENDING, garante projeto NEGOCIANDO, opcional mensagem no chat.
   */
  async sendProposal(projectId: string, userId: string, dto: SendProposalDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { professionalProfile: true },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    if (
      !project.professionalProfileId ||
      !project.professionalProfile ||
      project.professionalProfile.userId !== userId
    ) {
      throw new ForbiddenException('Apenas o profissional vinculado pode enviar proposta');
    }

    if (project.status !== 'NEGOCIANDO') {
      throw new BadRequestException(
        'Só é possível enviar proposta enquanto o projeto está em negociação',
      );
    }

    const parts: string[] = [
      `**Proposta:** R$ ${dto.price.toLocaleString('pt-BR')}`,
      ...(dto.packageType ? [`**Pacote / Escopo:** ${dto.packageType}`] : []),
      ...(dto.deadlineDays ? [`**Prazo estimado:** ${dto.deadlineDays} dias`] : []),
      ...(dto.message?.trim() ? ['', dto.message.trim()] : []),
    ];
    const content = parts.join('\n');

    await this.prisma.$transaction([
      this.prisma.proposal.create({
        data: {
          projectId,
          professionalProfileId: project.professionalProfileId,
          price: dto.price,
          status: 'PENDING',
          packageType: dto.packageType,
          estimatedDays: dto.deadlineDays,
          notes: dto.message?.trim() || undefined,
        },
      }),
      this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'NEGOCIANDO',
          price: dto.price,
          ...(dto.packageType && { packageType: dto.packageType }),
        },
      }),
      this.prisma.message.create({
        data: {
          projectId,
          senderId: userId,
          content,
        },
      }),
    ]);

    this.logger.log(`Proposta PENDING criada no projeto ${projectId}: R$ ${dto.price}`);
    return this.getProposalsByProject(projectId, userId);
  }

  /**
   * Lista propostas do projeto (cliente ou profissional do projeto).
   * Front usa proposta com status PENDING para mostrar card Aceitar/Recusar.
   */
  async getProposalsByProject(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { professionalProfile: true },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    const isClient = project.clientId === userId;
    const isProfessional =
      project.professionalProfile?.userId === userId;
    if (!isClient && !isProfessional) {
      throw new ForbiddenException('Sem permissão para ver propostas deste projeto');
    }

    const data = await this.prisma.proposal.findMany({
      where: { projectId },
      include: {
        professionalProfile: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: data.map((p) => ({
        id: p.id,
        projectId: p.projectId,
        professionalProfileId: p.professionalProfileId,
        price: p.price,
        status: p.status,
        packageType: p.packageType,
        estimatedDays: p.estimatedDays,
        notes: p.notes,
        message: p.notes,
        createdAt: p.createdAt,
        professionalProfile: p.professionalProfile
          ? {
              displayName: p.professionalProfile.displayName,
              user: p.professionalProfile.user
                ? { name: p.professionalProfile.user.name }
                : undefined,
            }
          : undefined,
      })),
    };
  }

  /**
   * Cliente aceita ou recusa proposta.
   * Aceitar: proposta → ACCEPTED, projeto → PROFESSIONAL_ASSIGNED, cria pagamento PENDING.
   * Projeto só vai para IN_PROGRESS quando admin confirmar recebimento PIX (mark-received).
   * Recusar: proposta → DECLINED, projeto permanece NEGOCIANDO.
   */
  async respondToProposal(proposalId: string, userId: string, dto: RespondProposalDto) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { project: true },
    });

    if (!proposal) {
      throw new NotFoundException('Proposta não encontrada');
    }

    if (proposal.project.clientId !== userId) {
      throw new ForbiddenException('Apenas o cliente do projeto pode aceitar ou recusar a proposta');
    }

    if (proposal.status !== 'PENDING') {
      throw new BadRequestException('Esta proposta já foi respondida');
    }

    if (dto.action === 'accept') {
      const platformFee = Math.round(proposal.price * this.platformFeeRate * 100) / 100;
      const professionalAmount = Math.round((proposal.price - platformFee) * 100) / 100;

      await this.prisma.$transaction(async (tx) => {
        await tx.proposal.update({
          where: { id: proposalId },
          data: { status: 'ACCEPTED' },
        });
        await tx.project.update({
          where: { id: proposal.projectId },
          data: {
            status: 'PROFESSIONAL_ASSIGNED',
            price: proposal.price,
            packageType: proposal.packageType ?? undefined,
          },
        });
        await tx.payment.create({
          data: {
            projectId: proposal.projectId,
            amount: proposal.price,
            platformFee,
            professionalAmount,
            status: 'PENDING',
          },
        });
      });
      this.logger.log(`Proposta ${proposalId} aceita; projeto ${proposal.projectId} → PROFESSIONAL_ASSIGNED (pagamento PENDING criado)`);
    } else {
      await this.prisma.proposal.update({
        where: { id: proposalId },
        data: { status: 'DECLINED' },
      });
      this.logger.log(`Proposta ${proposalId} recusada; projeto permanece NEGOCIANDO`);
    }

    return this.getProposalsByProject(proposal.projectId, userId);
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
