import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { SendProposalDto, RespondProposalDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

/**
 * Proposals: listar por projeto, criar proposta (profissional), aceitar/recusar (cliente).
 */
@ApiTags('Proposals')
@ApiBearerAuth('JWT-auth')
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * POST /api/v1/proposals/:proposalId/respond — Cliente aceita ou recusa proposta
   */
  @Post(':id/respond')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Aceitar ou recusar proposta (cliente)' })
  async respondToProposal(
    @Param('id') proposalId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RespondProposalDto,
  ) {
    return this.projectsService.respondToProposal(proposalId, user.id, dto);
  }

  /**
   * POST /api/v1/proposals/:projectId — Profissional envia proposta (cria registro PENDING)
   */
  @Post(':id')
  @Roles(Role.PROFESSIONAL)
  @ApiOperation({ summary: 'Enviar proposta ao cliente (valor, escopo, prazo, observações)' })
  async sendProposal(
    @Param('id') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendProposalDto,
  ) {
    return this.projectsService.sendProposal(projectId, user.id, dto);
  }

  /**
   * GET /api/v1/proposals/:projectId — Listar propostas do projeto (cliente ou profissional)
   */
  @Get(':id')
  @ApiOperation({ summary: 'Listar propostas do projeto' })
  async getProposals(
    @Param('id') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.getProposalsByProject(projectId, user.id);
  }
}
