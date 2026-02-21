import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

/**
 * Controller de Avaliações.
 */
@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * POST /api/v1/reviews/:projectId — Avaliar projeto
   */
  @Post(':projectId')
  @Roles(Role.CLIENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Criar avaliação para projeto concluído' })
  async create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(projectId, user.id, dto);
  }

  /**
   * GET /api/v1/reviews/project/:projectId — Buscar a avaliação que eu dei para este projeto (nota e comentário)
   */
  @Get('project/:projectId')
  @Roles(Role.CLIENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Buscar avaliação do projeto (nota e comentário que o cliente deu)' })
  async findByProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.findByProject(projectId, user.id);
  }

  /**
   * GET /api/v1/reviews/professional/:id — Reviews públicas do profissional
   */
  @Public()
  @Get('professional/:id')
  @ApiOperation({ summary: 'Listar avaliações públicas de um profissional' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findByProfessional(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.findByProfessional(id, page, limit);
  }
}
