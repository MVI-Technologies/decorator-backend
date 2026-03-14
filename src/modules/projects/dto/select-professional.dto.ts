import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para selecionar profissional e iniciar fluxo de pagamento Mercado Pago.
 * POST /projects/:id/select-professional
 */
export class SelectProfessionalDto {
  @ApiProperty({
    description: 'ID do ProfessionalProfile selecionado pelo cliente',
    example: 'uuid-do-profissional',
  })
  @IsString()
  @IsUUID()
  professionalProfileId: string;
}
