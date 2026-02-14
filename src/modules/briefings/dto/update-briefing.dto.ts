import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateBriefingDto } from './create-briefing.dto';

/**
 * DTO para atualização de briefing.
 * Todos os campos são opcionais. projectTitle é aceito no body mas não é alterado (evita 400 se o front enviar).
 */
export class UpdateBriefingDto extends PartialType(
  OmitType(CreateBriefingDto, ['projectTitle'] as const),
) {
  @ApiPropertyOptional({ description: 'Título do projeto (ignorado na edição)' })
  @IsOptional()
  @IsString()
  projectTitle?: string;
}
