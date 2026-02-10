import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para atualização do perfil base do usuário.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Nome completo', example: 'João Silva' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Telefone', example: '(11) 99999-9999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'URL do avatar', example: 'https://...' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
