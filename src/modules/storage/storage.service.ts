import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../auth/supabase.service';

/**
 * Service de Storage.
 * Upload e gerenciamento de arquivos via Supabase Storage.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket = 'decorador-files';

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Faz upload de um arquivo para o Supabase Storage.
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('Arquivo muito grande. Máximo: 10MB');
    }

    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${folder}/${userId}/${timestamp}_${safeName}`;

    const client = this.supabaseService.getAdminClient();

    const { data, error } = await client.storage
      .from(this.bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Erro no upload: ${error.message}`);
      throw new BadRequestException('Erro ao fazer upload do arquivo');
    }

    // Gerar URL pública
    const { data: urlData } = client.storage
      .from(this.bucket)
      .getPublicUrl(data.path);

    this.logger.log(`Upload: ${filePath} (${file.size} bytes)`);

    return {
      path: data.path,
      url: urlData.publicUrl,
      fileName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  /**
   * Remove um arquivo do Supabase Storage.
   */
  async deleteFile(filePath: string) {
    const client = this.supabaseService.getAdminClient();

    const { error } = await client.storage
      .from(this.bucket)
      .remove([filePath]);

    if (error) {
      this.logger.error(`Erro ao deletar: ${error.message}`);
      throw new BadRequestException('Erro ao deletar arquivo');
    }

    return { success: true };
  }
}
