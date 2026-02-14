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

  /** Tipos MIME permitidos e extensão para avatar */
  private readonly avatarAllowedMimes: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  private readonly avatarMaxSize = 2 * 1024 * 1024; // 2MB

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
   * Upload de avatar do usuário.
   * Valida: image/jpeg, image/png, image/webp, image/gif e máximo 2MB.
   * Salva em avatars/{userId}.{ext} (upsert para substituir o anterior).
   */
  async uploadAvatar(file: Express.Multer.File, userId: string): Promise<{ url: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    const ext = this.avatarAllowedMimes[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        'Tipo de arquivo não permitido. Use JPG, PNG, WebP ou GIF.',
      );
    }
    if (file.size > this.avatarMaxSize) {
      throw new BadRequestException(
        'Arquivo muito grande. Tamanho máximo: 2MB.',
      );
    }

    const filePath = `avatars/${userId}.${ext}`;
    const client = this.supabaseService.getAdminClient();

    const { data, error } = await client.storage
      .from(this.bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Erro no upload do avatar: ${error.message}`);
      throw new BadRequestException('Erro ao fazer upload do avatar');
    }

    const { data: urlData } = client.storage
      .from(this.bucket)
      .getPublicUrl(data.path);

    this.logger.log(`Avatar atualizado: ${filePath} (${file.size} bytes)`);

    return { url: urlData.publicUrl };
  }

  /**
   * Extrai o path do bucket a partir da URL pública do Supabase.
   * Ex.: https://xxx.supabase.co/storage/v1/object/public/decorador-files/avatars/userId.jpg → avatars/userId.jpg
   */
  getStoragePathFromPublicUrl(publicUrl: string | null | undefined): string | null {
    if (!publicUrl || typeof publicUrl !== 'string') return null;
    const prefix = `/object/public/${this.bucket}/`;
    const i = publicUrl.indexOf(prefix);
    if (i === -1) return null;
    return publicUrl.slice(i + prefix.length).split('?')[0].trim() || null;
  }

  /**
   * Remove o avatar do Storage pelo path (ex.: avatars/userId.jpg).
   * Não lança erro se o arquivo não existir.
   */
  async deleteAvatarByPath(filePath: string): Promise<void> {
    if (!filePath || !filePath.startsWith('avatars/')) return;
    const client = this.supabaseService.getAdminClient();
    const { error } = await client.storage.from(this.bucket).remove([filePath]);
    if (error) {
      this.logger.warn(`Erro ao remover avatar ${filePath}: ${error.message}`);
      // Não lançar — o arquivo pode já ter sido removido
    } else {
      this.logger.log(`Avatar removido: ${filePath}`);
    }
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
