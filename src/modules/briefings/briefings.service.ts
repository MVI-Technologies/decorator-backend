import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBriefingDto, UpdateBriefingDto } from './dto';

/**
 * Service de Briefings.
 * Gerencia a criação e edição de briefings vinculados a projetos.
 */
@Injectable()
export class BriefingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista todos os projetos (com briefing) do cliente autenticado.
   */
  async findAll(clientId: string, page = 1, limit = 10) {
    const skip = (Number(page) - 1) * Number(limit);

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where: { clientId },
        include: {
          briefing: true,
          payment: true,
          professionalProfile: {
            include: { user: { select: { name: true, avatarUrl: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.project.count({ where: { clientId } }),
    ]);

    return {
      data: projects,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Cria um novo projeto + briefing em uma transação atômica.
   */
  async create(clientId: string, dto: CreateBriefingDto) {

    return this.prisma.$transaction(async (tx) => {
      // 1. Criar o projeto
      const project = await tx.project.create({
        data: {
          clientId,
          title: dto.projectTitle,
        },
      });

      // 2. Criar o briefing vinculado
      const briefing = await tx.briefing.create({
        data: {
          projectId: project.id,
          roomType: dto.roomType,
          roomSize: dto.roomSize,
          budget: dto.budget,
          description: dto.description,
          stylePreferences: dto.stylePreferences || [],
          referenceImages: dto.referenceImages || [],
          requirements: dto.requirements,
          deadline: (() => {
            if (!dto.deadline) return null;
            const d = new Date(dto.deadline);
            return isNaN(d.getTime()) ? null : d;
          })(),
        },
      });

      return {
        project,
        briefing,
      };
    });
  }

  /**
   * Atualiza um briefing existente.
   * Apenas o cliente dono do projeto pode editar.
   */
  async update(briefingId: string, clientId: string, dto: UpdateBriefingDto) {
    const briefing = await this.prisma.briefing.findUnique({
      where: { id: briefingId },
      include: { project: true },
    });

    if (!briefing) {
      throw new NotFoundException('Briefing não encontrado');
    }

    if (briefing.project.clientId !== clientId) {
      throw new ForbiddenException('Você não tem permissão para editar este briefing');
    }

    // Só pode editar se o projeto ainda está em fase de briefing, matching ou negociando
    const editableStatuses = ['BRIEFING_SUBMITTED', 'MATCHING', 'NEGOCIANDO'];
    if (!editableStatuses.includes(briefing.project.status)) {
      throw new BadRequestException(
        'O briefing só pode ser editado enquanto o projeto está em fase de briefing ou matching',
      );
    }

    return this.prisma.briefing.update({
      where: { id: briefingId },
      data: {
        ...(dto.roomType !== undefined && { roomType: dto.roomType }),
        ...(dto.roomSize !== undefined && { roomSize: dto.roomSize }),
        ...(dto.budget !== undefined && { budget: dto.budget }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.stylePreferences !== undefined && { stylePreferences: dto.stylePreferences }),
        ...(dto.referenceImages !== undefined && { referenceImages: dto.referenceImages }),
        ...(dto.requirements !== undefined && { requirements: dto.requirements }),
        ...(dto.deadline !== undefined && {
          deadline: (() => {
            if (!dto.deadline) return null;
            const d = new Date(dto.deadline);
            return isNaN(d.getTime()) ? null : d;
          })(),
        }),
      },
    });
  }

  /**
   * Busca um briefing por ID.
   */
  async findOne(briefingId: string, userId: string) {
    const briefing = await this.prisma.briefing.findUnique({
      where: { id: briefingId },
      include: {
        project: {
          include: {
            professionalProfile: {
              include: { user: { select: { name: true, avatarUrl: true } } },
            },
          },
        },
      },
    });

    if (!briefing) {
      throw new NotFoundException('Briefing não encontrado');
    }

    // Verificar acesso: cliente dono ou profissional atribuído
    const isOwner = briefing.project.clientId === userId;
    const isProfessional = briefing.project.professionalProfile?.userId === userId;

    if (!isOwner && !isProfessional) {
      throw new ForbiddenException('Sem permissão para visualizar este briefing');
    }

    return briefing;
  }

  /**
   * Remove um briefing e o projeto associado.
   * Apenas o cliente dono pode excluir, e só enquanto o projeto está em BRIEFING_SUBMITTED, MATCHING ou NEGOCIANDO.
   */
  async remove(briefingId: string, clientId: string) {
    const briefing = await this.prisma.briefing.findUnique({
      where: { id: briefingId },
      include: { project: true },
    });

    if (!briefing) {
      throw new NotFoundException('Briefing não encontrado');
    }

    if (briefing.project.clientId !== clientId) {
      throw new ForbiddenException('Você não tem permissão para excluir este briefing');
    }

    const deletableStatuses = ['BRIEFING_SUBMITTED', 'MATCHING', 'NEGOCIANDO'];
    if (!deletableStatuses.includes(briefing.project.status)) {
      throw new BadRequestException(
        'O briefing só pode ser excluído enquanto o projeto está em fase de briefing ou matching',
      );
    }

    // Deletar o projeto (cascade remove o briefing e demais dependências)
    await this.prisma.project.delete({
      where: { id: briefing.projectId },
    });

    return { message: 'Briefing e projeto excluídos com sucesso' };
  }
}
