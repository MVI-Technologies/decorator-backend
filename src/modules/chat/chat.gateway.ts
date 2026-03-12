import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { MessageContentValidator } from './message-validator.service';

/**
 * Gateway WebSocket para chat em tempo real.
 *
 * Eventos:
 * - joinProject: entrar na sala do projeto
 * - sendMessage: enviar mensagem
 * - markRead: marcar como lido
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly messageValidator: MessageContentValidator,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Entra na sala do projeto para receber mensagens em tempo real.
   */
  @SubscribeMessage('joinProject')
  handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    client.join(`project:${data.projectId}`);
    this.logger.log(`Client ${client.id} joined project:${data.projectId}`);
    return { event: 'joined', data: { projectId: data.projectId } };
  }

  /**
   * Envia uma mensagem no chat do projeto.
   * fileStoragePath: path no bucket privado do chat (para renovar signed URL).
   */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      projectId: string;
      senderId: string;
      content: string;
      fileUrl?: string;
      fileStoragePath?: string;
      fileType?: string;
    },
  ) {
    if (data.content) {
      this.messageValidator.validate(data.content);
    }

    const message = await this.chatService.createMessage(
      data.projectId,
      data.senderId,
      data.content,
      data.fileUrl,
      data.fileStoragePath,
      data.fileType,
    );

    if (message) {
      // Payload para o front: id evita duplicata no cache; sender evita refetch para nome/role
      const payload = {
        id: message.id,
        projectId: message.projectId,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        ...(message.fileUrl && { fileUrl: message.fileUrl }),
        ...(message.fileStoragePath && { fileStoragePath: message.fileStoragePath }),
        ...(message.sender && {
          sender: {
            id: message.sender.id,
            name: message.sender.name,
            role: message.sender.role,
          },
        }),
      };
      // Broadcast para a sala inteira (incluindo o autor) — chat instantâneo sem polling
      this.server.to(`project:${data.projectId}`).emit('newMessage', payload);
    }

    return message;
  }

  /**
   * Marca mensagens como lidas.
   */
  @SubscribeMessage('markRead')
  async handleMarkRead(
    @MessageBody() data: { projectId: string; userId: string },
  ) {
    return this.chatService.markAsRead(data.projectId, data.userId);
  }
}
