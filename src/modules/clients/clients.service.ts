import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateClientProfileDto } from './dto';

/**
 * Service de Clientes.
 * Gerencia o perfil do CLIENT, incluindo o flag de onboarding concluído.
 */
@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna o perfil completo do próprio cliente.
   */
  async getOwnProfile(userId: string) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil de cliente não encontrado');
    }

    return profile;
  }

  /**
   * Atualiza o perfil do cliente.
   * Aceita qualquer subconjunto dos campos, incluindo `onboardingCompleted`.
   */
  async updateProfile(userId: string, dto: UpdateClientProfileDto) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Perfil de cliente não encontrado');
    }

    return this.prisma.clientProfile.update({
      where: { userId },
      data: dto,
    });
  }
}
