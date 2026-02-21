import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../auth/supabase.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../../common/enums/role.enum';

/** Bucket público: fotos (avatar, portfólio, etc.). */
const BUCKET_PUBLIC = 'decorador-files';

/** Bucket privado: anexos do chat (acesso via signed URL). */
const BUCKET_CHAT_DEFAULT = 'decorador-chat';

/**
 * Service de Storage.
 * - Fotos/arquivos públicos: bucket decorador-files.
 * - Anexos do chat: bucket privado separado (decorador-chat), acesso via signed URL.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket = BUCKET_PUBLIC;
  private readonly chatBucket: string;

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
    private readonly prisma: PrismaService,
  ) {
    this.chatBucket = this.configService.get<string>('STORAGE_CHAT_BUCKET', BUCKET_CHAT_DEFAULT);
  }

  /**
   * Faz upload de um arquivo para o Supabase Storage.
   * - folder !== 'chat': bucket público (decorador-files), retorna URL pública.
   * - folder === 'chat': bucket privado (decorador-chat), retorna signed URL + path (para refresh).
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
    const isChat = folder === 'chat';
    const filePath = isChat
      ? `${userId}/${timestamp}_${safeName}`
      : `${folder}/${userId}/${timestamp}_${safeName}`;
    const bucketToUse = isChat ? this.chatBucket : this.bucket;

    const client = this.supabaseService.getAdminClient();

    const { data, error } = await client.storage
      .from(bucketToUse)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Erro no upload: ${error.message}`);
      throw new BadRequestException('Erro ao fazer upload do arquivo');
    }

    if (isChat) {
      // Bucket privado: retornar signed URL (7 dias) + path para refresh
      const expiresIn = 7 * 24 * 60 * 60; // 7 dias em segundos
      const { data: signedData, error: signedError } = await client.storage
        .from(bucketToUse)
        .createSignedUrl(data.path, expiresIn);

      if (signedError || !signedData?.signedUrl) {
        this.logger.error(`Erro ao gerar signed URL: ${signedError?.message}`);
        throw new BadRequestException('Erro ao gerar link do arquivo');
      }

      this.logger.log(`Upload chat: ${filePath} (${file.size} bytes)`);
      return {
        path: data.path,
        url: signedData.signedUrl,
        fileName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      };
    }

    // Bucket público: URL pública
    const { data: urlData } = client.storage
      .from(bucketToUse)
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
   * Retorna uma signed URL para um arquivo do chat (bucket privado).
   * Só gera URL se o usuário tiver acesso à mensagem (cliente, profissional ou admin do projeto).
   */
  async getChatFileSignedUrl(
    path: string,
    userId: string,
    role: Role,
  ): Promise<{ url: string }> {
    const message = await this.prisma.message.findFirst({
      where: { fileStoragePath: path },
      include: {
        project: {
          include: { professionalProfile: true },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Arquivo não encontrado');
    }

    const project = message.project;
    const isClient = project.clientId === userId;
    const isProfessional = project.professionalProfile?.userId === userId;
    const isAdmin = role === Role.ADMIN;
    if (!isClient && !isProfessional && !isAdmin) {
      throw new ForbiddenException('Sem permissão para acessar este arquivo');
    }

    const client = this.supabaseService.getAdminClient();
    const expiresIn = 60 * 60; // 1 hora
    const { data, error } = await client.storage
      .from(this.chatBucket)
      .createSignedUrl(path, expiresIn);

    if (error || !data?.signedUrl) {
      this.logger.error(`Erro signed URL: ${error?.message}`);
      throw new BadRequestException('Erro ao gerar link do arquivo');
    }

    return { url: data.signedUrl };
  }

  /**
   * Remove um arquivo do Supabase Storage.
   * Para arquivos do chat, use bucket=chat (query) para o bucket privado.
   */
  async deleteFile(filePath: string, bucket?: string) {
    const client = this.supabaseService.getAdminClient();
    const bucketToUse = bucket === 'chat' ? this.chatBucket : this.bucket;

    const { error } = await client.storage
      .from(bucketToUse)
      .remove([filePath]);

    if (error) {
      this.logger.error(`Erro ao deletar: ${error.message}`);
      throw new BadRequestException('Erro ao deletar arquivo');
    }

    return { success: true };
  }
}
