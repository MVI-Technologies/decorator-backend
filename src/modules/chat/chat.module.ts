import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { MessageContentValidator } from './message-validator.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, MessageContentValidator],
  exports: [ChatService],
})
export class ChatModule {}
