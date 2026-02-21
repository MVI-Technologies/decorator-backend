import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProfessionalsService } from './professionals.service';
import {
  UpdateProfessionalProfileDto,
  CreatePortfolioItemDto,
  CreateStyleDto,
  DeliverProjectDto,
} from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

/**
 * Controller de Profissionais.
 */
@ApiTags('Professionals')
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  // ─── PERFIL ────────────────────────────────────────────

  /**
   * GET /api/v1/professionals/:id — Perfil público
   */
  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Ver perfil público do profissional' })
  async getPublicProfile(@Param('id') id: string) {
    return this.professionalsService.getPublicProfile(id);
  }

  /**
   * GET /api/v1/professionals/me/profile — Perfil completo (próprio)
   */
  @Get('me/profile')
  @Roles(Role.PROFESSIONAL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ver meu perfil profissional completo' })
  async getOwnProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.professionalsService.getOwnProfile(user.id);
  }

  /**
   * PATCH /api/v1/professionals/me/profile — Atualizar perfil
   */
  @Patch('me/profile')
  @Roles(Role.PROFESSIONAL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Atualizar perfil profissional' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfessionalProfileDto,
  ) {
    return this.professionalsService.updateProfile(user.id, dto);
  }

  // ─── ESTILOS (listar antes de portfólio para rotas me/*) ───

  /**
   * GET /api/v1/professionals/me/styles — Listar estilos associados ao meu perfil
   */
  @Get('me/styles')
  @Roles(Role.PROFESSIONAL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Listar estilos associados ao meu perfil' })
  async getMyStyles(@CurrentUser() user: AuthenticatedUser) {
    return this.professionalsService.getMyStyles(user.id);
  }

  // ─── PORTFÓLIO ────────────────────────────────────────

  /**
   * POST /api/v1/professionals/me/portfolio — Adicionar item
   */
  @Post('me/portfolio')
  @Roles(Role.PROFESSIONAL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Adicionar item ao portfólio' })
  async addPortfolioItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePortfolioItemDto,
  ) {
    return this.professionalsService.addPortfolioItem(user.id, dto);
  }

  /**
   * DELETE /api/v1/professionals/me/portfolio/:itemId — Remover item
   */
  @Delete('me/portfolio/:itemId')
  @Roles(Role.PROFESSIONAL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remover item do portfólio' })
  async removePortfolioItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId') itemId: string,
  ) {
    return this.professionalsService.removePortfolioItem(user.id, itemId);
  }

  /**
   * POST /api/v1/professionals/me/styles — Adicionar estilo
   */
  @Post('me/styles')
  @Roles(Role.PROFESSIONAL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Adicionar estilo ao perfil' })
  async addStyle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStyleDto,
  ) {
    return this.professionalsService.addStyle(user.id, dto);
  }

  /**
   * DELETE /api/v1/professionals/me/styles/:styleId — Remover estilo
   */
  @Delete('me/styles/:styleId')
  @Roles(Role.PROFESSIONAL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remover estilo do perfil' })
  async removeStyle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('styleId') styleId: string,
  ) {
    return this.professionalsService.removeStyle(user.id, styleId);
  }

  // ─── PROJETOS ────────────────────────────────────────

  /**
   * GET /api/v1/professionals/me/projects — Meus projetos
   */
  @Get('me/projects')
  @Roles(Role.PROFESSIONAL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Listar meus projetos atribuídos' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyProjects(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.professionalsService.getMyProjects(user.id, page, limit);
  }

  /**
   * POST /api/v1/professionals/me/projects/:id/accept — Aceitar projeto
   */
  @Post('me/projects/:id/accept')
  @Roles(Role.PROFESSIONAL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Aceitar projeto atribuído' })
  async acceptProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.professionalsService.acceptProject(user.id, id);
  }

  /**
   * POST /api/v1/professionals/me/projects/:id/deliver — Entregar projeto
   */
  @Post('me/projects/:id/deliver')
  @Roles(Role.PROFESSIONAL)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Entregar projeto' })
  async deliverProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DeliverProjectDto,
  ) {
    return this.professionalsService.deliverProject(user.id, id, dto);
  }
}
