import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto, UpdateClientProfileDto } from './dto';
import { Role } from '../../common/enums/role.enum';

/**
 * Service de gerenciamento de usuários e perfis.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
    return safeUser;
  }

  /**
   * Atualiza dados básicos do usuário (nome, telefone, avatar).
   */
  async updateProfile(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });

    const { supabaseAuthId, ...safeUser } = user;
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
