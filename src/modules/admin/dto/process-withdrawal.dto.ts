import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum WithdrawalAction {
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

/**
 * DTO para processar saque.
 */
export class ProcessWithdrawalDto {
  @ApiProperty({ enum: WithdrawalAction })
  @IsEnum(WithdrawalAction)
  action: WithdrawalAction;

  @ApiPropertyOptional({ description: 'Notas do admin' })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}
