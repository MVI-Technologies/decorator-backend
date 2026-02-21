import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

/**
 * Alias para o front que chama GET /api/v1/proposals/:id (histórico de chats).
 * Retorna o mesmo que GET /api/v1/projects/:id — detalhes do projeto com mensagens, etc.
 */
@ApiTags('Proposals')
@ApiBearerAuth('JWT-auth')
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do projeto/proposta (alias de GET /projects/:id)' })
  async findOne(
    @Param('id') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.findOne(projectId, user.id);
  }
}
