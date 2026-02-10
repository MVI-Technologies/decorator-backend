import { IsNotEmpty, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criar item de portfólio.
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

  @ApiProperty({ description: 'URL da imagem', example: 'https://...' })
  @IsNotEmpty()
  @IsString()
  imageUrl: string;

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
