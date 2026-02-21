import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para iniciar conversa com um profissional (solicitar proposta).
 */
export class RequestProposalDto {
  @ApiProperty({
    description: 'ID do perfil do profissional com quem iniciar a conversa',
    example: 'uuid-do-profissional',
  })
  @IsNotEmpty()
  @IsString()
  professionalProfileId: string;

  @ApiPropertyOptional({
    description: 'Mensagem inicial opcional para o profissional',
    example: 'Tenho urgência no projeto, meu apartamento fica em SP e preciso de acabamentos sustentáveis.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  initialMessage?: string;
}
