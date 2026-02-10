import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Service de Chat.
 * Gerencia mensagens entre cliente e profissional em um projeto.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria uma nova mensagem no chat do projeto.
   */
  async createMessage(projectId: string, senderId: string, content: string, fileUrl?: string) {
    // Verificar se o usuário tem acesso ao projeto
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { professionalProfile: true },
    });

    if (!project) return null;

    const isClient = project.clientId === senderId;
    const isProfessional = project.professionalProfile?.userId === senderId;
    if (!isClient && !isProfessional) return null;

    const message = await this.prisma.message.create({
      data: {
        projectId,
        senderId,
        content,
        fileUrl,
      },
      include: {
        sender: { select: { name: true, avatarUrl: true } },
      },
    });

    this.logger.log(`Mensagem no projeto ${projectId} por ${senderId}`);
    return message;
  }

  /**
   * Lista mensagens de um projeto (paginado, mais recentes primeiro).
   */
  async getMessages(projectId: string, userId: string, page = 1, limit = 50) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { professionalProfile: true },
    });

    if (!project) return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };

    const isClient = project.clientId === userId;
    const isProfessional = project.professionalProfile?.userId === userId;
    if (!isClient && !isProfessional) return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { projectId },
        include: { sender: { select: { name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.message.count({ where: { projectId } }),
    ]);

    return {
      data: messages,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Marca mensagens como lidas.
   */
  async markAsRead(projectId: string, userId: string) {
    await this.prisma.message.updateMany({
      where: {
        projectId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    return { success: true };
  }
}
