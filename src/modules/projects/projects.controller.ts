import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import {
  AssignProfessionalDto,
  RequestProposalDto,
  RequestRevisionDto,
  SendProposalDto,
  SelectProfessionalDto,
} from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

/**
 * Controller de Projetos (fluxo do cliente).
 * Gerencia listagem, matching, contratação, acompanhamento e aprovação.
 */
@ApiTags('Projects')
@ApiBearerAuth('JWT-auth')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * GET /api/v1/projects — Listar projetos do cliente
   */
  @Get()
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Listar projetos do cliente' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.projectsService.findAllByClient(user.id, page, limit);
  }

  /**
   * GET /api/v1/projects/:id/match — Buscar profissionais compatíveis
   * (rota mais específica deve vir antes de GET :id)
   */
  @Get(':id/match')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Buscar profissionais compatíveis com o briefing' })
  async matchProfessionals(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.matchProfessionals(id, user.id);
  }

  /**
   * GET /api/v1/projects/:id — Detalhes do projeto
   */
  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do projeto' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.findOne(id, user.id);
  }

  /**
   * DELETE /api/v1/projects/:id — Cancelar projeto (soft delete: status CANCELLED; histórico permanece)
   */
  @Delete(':id')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Cancelar projeto (briefing/matching/negociando); notifica profissional; histórico visível' })
  async deleteProject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.deleteProject(id, user.id);
  }

  /**
   * POST /api/v1/projects/:id/request-proposal — Iniciar conversa com profissional (solicitar proposta)
   */
  @Post(':id/request-proposal')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Iniciar conversa com decorador e solicitar proposta' })
  async requestProposal(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestProposalDto,
  ) {
    return this.projectsService.requestProposal(id, user.id, dto);
  }

  /**
   * POST /api/v1/projects/:id/send-proposal — Profissional envia proposta (valor, escopo, prazo)
   */
  @Post(':id/send-proposal')
  @Roles(Role.PROFESSIONAL)
  @ApiOperation({ summary: 'Enviar proposta ao cliente (valor, escopo, prazo, observações)' })
  async sendProposal(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendProposalDto,
  ) {
    return this.projectsService.sendProposal(id, user.id, dto);
  }

  /**
   * POST /api/v1/projects/:id/assign — Contratar profissional
   */
  @Post(':id/assign')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Atribuir profissional e criar pagamento (escrow)' })
  async assignProfessional(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignProfessionalDto,
  ) {
    return this.projectsService.assignProfessional(id, user.id, dto);
  }

  /**
   * POST /api/v1/projects/:id/approve — Aprovar entrega
   */
  @Post(':id/approve')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Aprovar entrega e liberar escrow' })
  async approveDelivery(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.approveDelivery(id, user.id);
  }

  /**
   * POST /api/v1/projects/:id/revision — Solicitar revisão
   */
  @Post(':id/revision')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Solicitar revisão de projeto entregue' })
  async requestRevision(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestRevisionDto,
  ) {
    return this.projectsService.requestRevision(id, user.id, dto);
  }

  /**
   * GET /api/v1/projects/:id/chat-professionals
   * Lista profissionais com quem o cliente já conversou neste projeto.
   * Usado para popular a tela de seleção de decorador.
   */
  @Get(':id/chat-professionals')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Listar profissionais com chat ativo no projeto' })
  async getChatProfessionals(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.getChatProfessionals(id, user.id);
  }

  /**
   * POST /api/v1/projects/:id/select-professional
   * Cliente seleciona profissional e recebe URL de checkout do Mercado Pago.
   * Status do projeto → AWAITING_PAYMENT.
   */
  @Post(':id/select-professional')
  @Roles(Role.CLIENT)
  @ApiOperation({
    summary:
      'Selecionar profissional e criar preferência de pagamento Mercado Pago',
  })
  async selectProfessional(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SelectProfessionalDto,
  ) {
    return this.projectsService.selectProfessional(id, user.id, dto);
  }
}
