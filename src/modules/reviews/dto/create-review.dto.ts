import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criar avaliação de projeto.
 */
export class CreateReviewDto {
  @ApiProperty({ description: 'Nota de 1 a 5', example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ description: 'Comentário sobre o serviço' })
  @IsOptional()
  @IsString()
  comment?: string;
}
