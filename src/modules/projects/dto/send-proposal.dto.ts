import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para o profissional enviar proposta ao cliente (valor, escopo, prazo, observações).
 */
export class SendProposalDto {
  @ApiProperty({
    description: 'Valor da proposta em reais (R$)',
    example: 8000,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    description: 'Pacote / escopo (ex.: Básico, Completo, Premium)',
    example: 'Premium',
  })
  @IsOptional()
  @IsString()
  packageType?: string;

  @ApiPropertyOptional({
    description: 'Prazo estimado em dias',
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  deadlineDays?: number;

  @ApiPropertyOptional({
    description: 'Observações (o que está incluso, revisões, materiais, etc.)',
    example: 'Inclui 2 revisões e lista de materiais.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
