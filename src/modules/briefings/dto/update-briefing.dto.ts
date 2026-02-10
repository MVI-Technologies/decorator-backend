import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateBriefingDto } from './create-briefing.dto';

/**
 * DTO para atualização de briefing.
 * Todos os campos são opcionais, exceto projectTitle (não editável).
 */
export class UpdateBriefingDto extends PartialType(
  OmitType(CreateBriefingDto, ['projectTitle'] as const),
) {}
