import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para cliente aceitar ou recusar proposta.
 */
export class RespondProposalDto {
  @ApiProperty({
    description: 'Ação: accept ou decline',
    enum: ['accept', 'decline'],
    example: 'accept',
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(['accept', 'decline'])
  action: 'accept' | 'decline';
}
