import {
  Controller,
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
 * Upload e remoção de arquivos.
 */
@ApiTags('Storage')
@ApiBearerAuth('JWT-auth')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload de arquivo' })
  @ApiQuery({ name: 'folder', required: false, description: 'Pasta destino (ex: portfolio, projects)' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Query('folder') folder = 'general',
  ) {
    return this.storageService.uploadFile(file, folder, user.id);
  }

  @Delete(':path')
  @ApiOperation({ summary: 'Deletar arquivo' })
  async deleteFile(@Param('path') path: string) {
    return this.storageService.deleteFile(path);
  }
}
