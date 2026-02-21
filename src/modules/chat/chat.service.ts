import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../../common/enums/role.enum';

/**
 * Service de Chat.
 * Gerencia mensagens entre cliente, profissional e admin em um projeto.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica se o usuário tem acesso ao chat do projeto (cliente, profissional ou admin).
   */
  private async canAccessProjectChat(projectId: string, userId: string, role?: Role): Promise<boolean> {
    if (role === Role.ADMIN) return true;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { professionalProfile: true },
    });
    if (!project) return false;
    const isClient = project.clientId === userId;
    const isProfessional = project.professionalProfile?.userId === userId;
    return isClient || isProfessional;
  }

  /**
   * Cria uma nova mensagem no chat do projeto.
   * fileStoragePath: path no bucket privado do chat (para renovar signed URL depois).
   */
  async createMessage(
    projectId: string,
    senderId: string,
    content: string,
    fileUrl?: string,
    fileStoragePath?: string,
    fileType?: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { professionalProfile: true },
    });

    if (!project) return null;

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { role: true },
    });
    if (!sender) return null;

    const isClient = project.clientId === senderId;
    const isProfessional = project.professionalProfile?.userId === senderId;
    const isAdmin = sender.role === Role.ADMIN;
    if (!isClient && !isProfessional && !isAdmin) return null;

    const message = await this.prisma.message.create({
      data: {
        projectId,
        senderId,
        content,
        fileUrl,
        fileStoragePath: fileStoragePath ?? undefined,
        fileType: fileType as 'IMAGE' | 'PDF' | 'DOCUMENT' | 'OTHER' | undefined,
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
   * Acesso: cliente do projeto, profissional do projeto ou admin.
   */
  async getMessages(
    projectId: string,
    userId: string,
    page = 1,
    limit = 50,
    role?: Role,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { professionalProfile: true },
    });

    if (!project) return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };

    const isClient = project.clientId === userId;
    const isProfessional = project.professionalProfile?.userId === userId;
    const isAdmin = role === Role.ADMIN;
    if (!isClient && !isProfessional && !isAdmin) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

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
   * Marca mensagens como lidas. Acesso: cliente, profissional ou admin do projeto.
   */
  async markAsRead(projectId: string, userId: string, role?: Role) {
    const canAccess = await this.canAccessProjectChat(projectId, userId, role);
    if (!canAccess) return { success: false };

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
