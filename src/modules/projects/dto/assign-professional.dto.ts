import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para atribuir profissional a um projeto.
 */
export class AssignProfessionalDto {
  @ApiProperty({
    description: 'ID do perfil profissional',
    example: 'uuid-do-profissional',
  })
  @IsNotEmpty()
  @IsString()
  professionalProfileId: string;

  @ApiPropertyOptional({ description: 'Tipo de pacote', example: 'Premium' })
  @IsOptional()
  @IsString()
  packageType?: string;

  @ApiProperty({ description: 'Valor do projeto', example: 3500 })
  @IsNumber()
  @Min(0)
  price: number;
}
