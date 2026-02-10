import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para solicitar revisão.
 */
export class RequestRevisionDto {
  @ApiPropertyOptional({
    description: 'Comentário sobre o que precisa ser revisado',
    example: 'Gostaria de mudar a paleta de cores...',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
