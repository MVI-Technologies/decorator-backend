import { SetMetadata } from '@nestjs/common';

/** Chave de metadata usada pelo JwtAuthGuard para pular autenticação */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator que marca um endpoint como público (sem autenticação).
 * Uso: @Public()
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
