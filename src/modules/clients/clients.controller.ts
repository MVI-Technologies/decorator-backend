import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { UpdateClientProfileDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

/**
 * Controller de Clientes.
 * Expõe endpoints para o CLIENT gerenciar seu próprio perfil.
 */
@ApiTags('Clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  /**
   * GET /api/v1/clients/me/profile — Perfil completo do próprio cliente
   */
  @Get('me/profile')
  @Roles(Role.CLIENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ver meu perfil de cliente' })
  async getOwnProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.getOwnProfile(user.id);
  }

  /**
   * PATCH /api/v1/clients/me/profile — Atualizar perfil do cliente
   *
   * Usado pelo frontend para:
   * - Atualizar dados de endereço
   * - Marcar onboarding como concluído (`onboardingCompleted: true`)
   */
  @Patch('me/profile')
  @Roles(Role.CLIENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Atualizar perfil de cliente (inclui onboardingCompleted)' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateClientProfileDto,
  ) {
    return this.clientsService.updateProfile(user.id, dto);
  }
}
