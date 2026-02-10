import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criar estilo profissional.
 */
export class CreateStyleDto {
  @ApiProperty({ description: 'Nome do estilo', example: 'Minimalista' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Descrição do estilo' })
  @IsOptional()
  @IsString()
  description?: string;
}
