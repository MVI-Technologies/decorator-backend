import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

/**
 * Controller de Storage.
 * - Upload: folder=chat → bucket privado (signed URL); outros → bucket público.
 * - Chat: GET /storage/chat/signed-url para renovar link de anexo.
 */
@ApiTags('Storage')
@ApiBearerAuth('JWT-auth')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload de arquivo (folder=chat → bucket privado do chat)' })
  @ApiQuery({ name: 'folder', required: false, description: 'Pasta destino: chat | portfolio | projects | general' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Query('folder') folder = 'general',
  ) {
    return this.storageService.uploadFile(file, folder, user.id);
  }

  @Get('chat/signed-url')
  @ApiOperation({ summary: 'Obter signed URL para anexo do chat (renovar link expirado)' })
  @ApiQuery({ name: 'path', required: true, description: 'Path do arquivo no bucket do chat' })
  async getChatFileSignedUrl(
    @Query('path') path: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.storageService.getChatFileSignedUrl(path, user.id, user.role);
  }

  @Delete('chat')
  @ApiOperation({ summary: 'Deletar arquivo do bucket do chat' })
  @ApiQuery({ name: 'path', required: true, description: 'Path completo no bucket (ex: userId/timestamp_nome.pdf)' })
  async deleteChatFile(@Query('path') path: string) {
    return this.storageService.deleteFile(path, 'chat');
  }

  @Delete(':path')
  @ApiOperation({ summary: 'Deletar arquivo do bucket público' })
  async deleteFile(@Param('path') path: string) {
    return this.storageService.deleteFile(path);
  }
}
