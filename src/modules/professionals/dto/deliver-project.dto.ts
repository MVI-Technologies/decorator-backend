import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para entrega de projeto pelo profissional.
 */
export class DeliverProjectDto {
  @ApiPropertyOptional({ description: 'Mensagem de entrega' })
  @IsOptional()
  @IsString()
  message?: string;
}
