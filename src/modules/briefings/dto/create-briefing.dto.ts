import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criação de briefing (e projeto associado).
 */
export class CreateBriefingDto {
  @ApiProperty({ description: 'Título do projeto', example: 'Reforma da sala de estar' })
  @IsString()
  projectTitle: string;

  @ApiPropertyOptional({ description: 'Tipo de cômodo', example: 'Sala de estar' })
  @IsOptional()
  @IsString()
  roomType?: string;

  @ApiPropertyOptional({ description: 'Tamanho do cômodo', example: '30m²' })
  @IsOptional()
  @IsString()
  roomSize?: string;

  @ApiPropertyOptional({ description: 'Orçamento disponível', example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({
    description: 'Descrição detalhada do projeto',
    example: 'Quero uma sala moderna com tons neutros...',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Estilos preferidos',
    example: ['Moderno', 'Minimalista'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stylePreferences?: string[];

  @ApiPropertyOptional({
    description: 'URLs de imagens de referência',
    example: ['https://...'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  referenceImages?: string[];

  @ApiPropertyOptional({ description: 'Requisitos adicionais' })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({ description: 'Prazo desejado' })
  @IsOptional()
  @IsString()
  deadline?: string;
}
