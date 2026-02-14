import { Controller, Get, Patch, Post, Delete, Body, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, UpdateClientProfileDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

const AVATAR_MAX_SIZE = 2 * 1024 * 1024; // 2MB

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
   * Aceita application/json (nome, phone, avatarUrl) ou multipart/form-data (avatar = arquivo, opcional name e phone).
   * Avatar: JPG, PNG, WebP ou GIF, máx. 2MB. Salvo no Supabase Storage e URL gravada em avatarUrl.
   */
  @Patch('profile')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: AVATAR_MAX_SIZE },
    }),
  )
  @ApiOperation({ summary: 'Atualizar dados do perfil (nome, telefone, avatar)' })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({
    description:
      'JSON: name, phone, avatarUrl. Multipart: campo "avatar" (arquivo), opcional "name" e "phone".',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        phone: { type: 'string' },
        avatar: { type: 'string', format: 'binary' },
      },
    },
  })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    const updated = await this.usersService.updateProfile(user.id, dto, avatar);
    return { user: updated };
  }

  /**
   * POST /api/v1/users/avatar
   * Alternativa: envia apenas o arquivo de avatar (multipart/form-data, campo "avatar").
   * Validação e armazenamento iguais ao PATCH /users/profile.
   */
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: AVATAR_MAX_SIZE },
    }),
  )
  @ApiOperation({ summary: 'Upload de avatar (apenas arquivo)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { avatar: { type: 'string', format: 'binary' } },
    },
  })
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() avatar: Express.Multer.File,
  ) {
    if (!avatar) {
      throw new BadRequestException('Envie o arquivo no campo "avatar"');
    }
    const updated = await this.usersService.updateProfile(user.id, {}, avatar);
    return { user: updated };
  }

  /**
   * DELETE /api/v1/users/avatar
   * Remove o avatar do usuário (arquivo no Storage e avatarUrl no banco).
   */
  @Delete('avatar')
  @ApiOperation({ summary: 'Remover avatar do usuário' })
  async deleteAvatar(@CurrentUser() user: AuthenticatedUser) {
    const updated = await this.usersService.removeAvatar(user.id);
    return { user: updated };
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
