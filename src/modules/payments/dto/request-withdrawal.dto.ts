import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para solicitação de saque.
 */
export class RequestWithdrawalDto {
  @ApiProperty({ description: 'Valor do saque', example: 500.0 })
  @IsNumber()
  @Min(10, { message: 'O valor mínimo para saque é R$10,00' })
  amount: number;
}
