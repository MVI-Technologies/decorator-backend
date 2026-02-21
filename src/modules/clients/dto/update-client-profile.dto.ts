import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClientProfileDto {
  @ApiPropertyOptional({ description: 'Endereço do cliente' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Cidade' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Estado (UF)' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'CEP' })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Marca o onboarding inicial como concluído (persiste cross-device)',
  })
  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;
}
