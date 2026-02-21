import { IsNotEmpty, IsOptional, IsString, IsInt, Min, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criar item de portfólio.
 * Suporta imagem, documento (PDF/Word) ou link externo (site).
 */
export class CreatePortfolioItemDto {
  @ApiProperty({ description: 'Título do item', example: 'Sala de estar moderna' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Descrição' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'URL da imagem (capa/thumbnail). Obrigatória para exibição.',
    example: 'https://...',
  })
  @IsNotEmpty()
  @IsString()
  imageUrl: string;

  @ApiPropertyOptional({
    description: 'URL do documento (PDF, Word, etc.) para o cliente abrir/baixar',
    example: 'https://storage.../projeto.pdf',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  documentUrl?: string;

  @ApiPropertyOptional({
    description: 'URL externa (site do projeto, Behance, etc.)',
    example: 'https://www.behance.net/...',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  linkUrl?: string;

  @ApiPropertyOptional({ description: 'Categoria', example: 'Sala de estar' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Ordem de exibição', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
