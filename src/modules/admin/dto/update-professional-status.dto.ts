import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum ApprovalAction {
  APPROVE = 'APPROVED',
  REJECT = 'REJECTED',
  SUSPEND = 'SUSPENDED',
}

/**
 * DTO para aprovar/rejeitar/suspender profissional.
 */
export class UpdateProfessionalStatusDto {
  @ApiProperty({
    description: 'Nova ação sobre o profissional',
    enum: ApprovalAction,
  })
  @IsEnum(ApprovalAction)
  action: ApprovalAction;

  @ApiPropertyOptional({ description: 'Motivo (obrigatório para rejeição)' })
  @IsOptional()
  @IsString()
  reason?: string;
}
