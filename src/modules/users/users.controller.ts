import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, UpdateClientProfileDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

/**
 * Controller de gerenciamento de perfil do usuário.
 */
@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/v1/users/profile
   */
  @Get('profile')
  @ApiOperation({ summary: 'Obter perfil completo do usuário logado' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  /**
   * PATCH /api/v1/users/profile
   */
  @Patch('profile')
  @ApiOperation({ summary: 'Atualizar dados do perfil (nome, telefone, avatar)' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  /**
   * PATCH /api/v1/users/client-profile
   */
  @Patch('client-profile')
  @Roles(Role.CLIENT)
  @ApiOperation({ summary: 'Atualizar perfil de cliente (endereço, estilos)' })
  async updateClientProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateClientProfileDto,
  ) {
    return this.usersService.updateClientProfile(user.id, user.role, dto);
  }
}
