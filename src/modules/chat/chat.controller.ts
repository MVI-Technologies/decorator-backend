import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

/**
 * Controller REST para chat (histórico e mark-read).
 * Mensagens em tempo real são via WebSocket.
 */
@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':projectId/messages')
  @ApiOperation({ summary: 'Listar mensagens do projeto (cliente, profissional ou admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMessages(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getMessages(projectId, user.id, page, limit, user.role);
  }

  @Post(':projectId/read')
  @ApiOperation({ summary: 'Marcar mensagens como lidas (cliente, profissional ou admin)' })
  async markAsRead(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.markAsRead(projectId, user.id, user.role);
  }
}
