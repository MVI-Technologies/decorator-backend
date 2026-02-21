import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO único para atualização do perfil de cliente (usado em clients e users).
 */
export class UpdateClientProfileDto {
  @ApiPropertyOptional({ description: 'Endereço do cliente', example: 'Rua das Flores, 123' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Cidade', example: 'São Paulo' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Estado (UF)', example: 'SP' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'CEP', example: '01234-567' })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional({
    description: 'Estilos preferidos',
    example: ['Moderno', 'Minimalista'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredStyles?: string[];

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Marca o onboarding inicial como concluído (persiste cross-device)',
  })
  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;
}
