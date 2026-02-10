import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto';

/**
 * Service de Avaliações.
 * Gerencia reviews de projetos e recalcula rating do profissional.
 */
@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria uma avaliação para um projeto concluído.
   * Apenas o cliente dono pode avaliar.
   * Recalcula o rating médio do profissional.
   */
  async create(projectId: string, clientId: string, dto: CreateReviewDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { review: true },
    });

    if (!project) {
      throw new NotFoundException('Projeto não encontrado');
    }

    if (project.clientId !== clientId) {
      throw new ForbiddenException('Sem permissão para avaliar este projeto');
    }

    if (project.status !== 'COMPLETED') {
      throw new BadRequestException('Só é possível avaliar projetos concluídos');
    }

    if (project.review) {
      throw new BadRequestException('Este projeto já foi avaliado');
    }

    if (!project.professionalProfileId) {
      throw new BadRequestException('Projeto sem profissional atribuído');
    }

    // Criar review + recalcular rating (transação)
    const result = await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          projectId,
          rating: dto.rating,
          comment: dto.comment,
        },
      });

      // Recalcular rating médio do profissional
      const reviews = await tx.review.findMany({
        where: {
          project: {
            professionalProfileId: project.professionalProfileId,
          },
        },
        select: { rating: true },
      });

      const avgRating =
        reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

      await tx.professionalProfile.update({
        where: { id: project.professionalProfileId! },
        data: {
          averageRating: Math.round(avgRating * 10) / 10,
        },
      });

      this.logger.log(
        `Review criada para projeto ${projectId} — Rating: ${dto.rating} | ` +
        `Novo rating médio: ${avgRating.toFixed(1)}`,
      );

      return review;
    });

    return result;
  }

  /**
   * Lista reviews de um profissional (público).
   */
  async findByProfessional(professionalProfileId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          isPublic: true,
          project: { professionalProfileId },
        },
        include: {
          project: {
            select: {
              title: true,
              client: { select: { name: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({
        where: {
          isPublic: true,
          project: { professionalProfileId },
        },
      }),
    ]);

    return {
      data: reviews,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
