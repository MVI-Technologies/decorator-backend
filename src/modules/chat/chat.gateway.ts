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

  constructor(private readonly chatService: ChatService) {}

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
    },
  ) {
    const message = await this.chatService.createMessage(
      data.projectId,
      data.senderId,
      data.content,
      data.fileUrl,
    );

    if (message) {
      // Emitir para todos na sala do projeto
      this.server
        .to(`project:${data.projectId}`)
        .emit('newMessage', message);
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
