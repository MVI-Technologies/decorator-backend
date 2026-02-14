import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpdateUserDto, UpdateClientProfileDto } from './dto';
import { Role } from '../../common/enums/role.enum';
import { toAbsoluteAvatarUrl } from '../../common/utils/avatar-url.util';

/**
 * Service de gerenciamento de usuários e perfis.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Retorna o perfil completo do usuário com relações.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        clientProfile: true,
        professionalProfile: {
          include: {
            styles: true,
            portfolioItems: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const { supabaseAuthId, ...safeUser } = user;
    const baseUrl = this.configService.get<string>('APP_URL');
    safeUser.avatarUrl = toAbsoluteAvatarUrl(safeUser.avatarUrl, baseUrl) ?? null;
    return safeUser;
  }

  /**
   * Atualiza dados básicos do usuário (nome, telefone, avatar).
   * Se avatarFile for informado, faz upload para o storage e grava avatarUrl.
   */
  async updateProfile(
    userId: string,
    dto: UpdateUserDto,
    avatarFile?: Express.Multer.File,
  ) {
    let avatarUrl: string | undefined = dto.avatarUrl;

    if (avatarFile) {
      const { url } = await this.storageService.uploadAvatar(avatarFile, userId);
      avatarUrl = url;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
    });

    const { supabaseAuthId, ...safeUser } = user;
    const baseUrl = this.configService.get<string>('APP_URL');
    safeUser.avatarUrl = toAbsoluteAvatarUrl(safeUser.avatarUrl, baseUrl) ?? null;
    return safeUser;
  }

  /**
   * Remove o avatar do usuário: deleta o arquivo no Storage e zera avatarUrl.
   */
  async removeAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    if (user?.avatarUrl) {
      const path = this.storageService.getStoragePathFromPublicUrl(user.avatarUrl);
      if (path) {
        await this.storageService.deleteAvatarByPath(path);
      }
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });
    const { supabaseAuthId, ...safeUser } = updated;
    const baseUrl = this.configService.get<string>('APP_URL');
    safeUser.avatarUrl = toAbsoluteAvatarUrl(safeUser.avatarUrl, baseUrl) ?? null;
    return safeUser;
  }

  /**
   * Atualiza perfil de cliente (endereço, estilos preferidos).
   * Apenas usuários com role CLIENT podem usar.
   */
  async updateClientProfile(userId: string, userRole: Role, dto: UpdateClientProfileDto) {
    if (userRole !== Role.CLIENT) {
      throw new ForbiddenException('Apenas clientes podem atualizar o perfil de cliente');
    }

    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil de cliente não encontrado');
    }

    return this.prisma.clientProfile.update({
      where: { userId },
      data: {
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.zipCode !== undefined && { zipCode: dto.zipCode }),
        ...(dto.preferredStyles !== undefined && { preferredStyles: dto.preferredStyles }),
      },
    });
  }
}
