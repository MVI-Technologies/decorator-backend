import { Controller, Post, Patch, Get, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BriefingsService } from './briefings.service';
import { CreateBriefingDto, UpdateBriefingDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

/**
 * Controller de Briefings.
 * Criação e edição de briefings pelo cliente.
 */
@ApiTags('Briefings')
@ApiBearerAuth('JWT-auth')
@Controller('briefings')
export class BriefingsController {
  constructor(private readonly briefingsService: BriefingsService) {}

  /**
   * POST /api/v1/briefings — Cria projeto + briefing
   */
  @Post()
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Criar novo briefing (cria projeto automaticamente)' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBriefingDto,
  ) {
    return this.briefingsService.create(user.id, dto);
  }

  /**
   * PATCH /api/v1/briefings/:id — Editar briefing
   */
  @Patch(':id')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Editar briefing existente' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBriefingDto,
  ) {
    return this.briefingsService.update(id, user.id, dto);
  }

  /**
   * GET /api/v1/briefings/:id — Ver briefing
   */
  @Get(':id')
  @ApiOperation({ summary: 'Ver detalhes do briefing' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.briefingsService.findOne(id, user.id);
  }

  /**
   * DELETE /api/v1/briefings/:id — Excluir briefing e projeto
   */
  @Delete(':id')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Excluir briefing (e projeto associado)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.briefingsService.remove(id, user.id);
  }
}
