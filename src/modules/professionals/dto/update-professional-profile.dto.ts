import { IsOptional, IsString, IsInt, Min, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para atualização do perfil profissional.
 */
export class UpdateProfessionalProfileDto {
  @ApiPropertyOptional({ description: 'Nome de exibição', example: 'Arq. Maria Design' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Bio/descrição profissional' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'CPF ou CNPJ' })
  @IsOptional()
  @IsString()
  cpfCnpj?: string;

  @ApiPropertyOptional({ description: 'URL do documento de verificação' })
  @IsOptional()
  @IsString()
  documentUrl?: string;

  @ApiPropertyOptional({ description: 'Anos de experiência', example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  experienceYears?: number;

  @ApiPropertyOptional({ description: 'Cidade', example: 'São Paulo' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Estado', example: 'SP' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Nome do banco' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ description: 'Agência' })
  @IsOptional()
  @IsString()
  bankAgency?: string;

  @ApiPropertyOptional({ description: 'Conta bancária' })
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional({ description: 'Chave PIX' })
  @IsOptional()
  @IsString()
  pixKey?: string;

  @ApiPropertyOptional({ description: 'Instagram handle (@username)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => {
    if (!value) return value;
    let clean = value.trim();
    if (clean.includes('instagram.com/')) {
      clean = clean.split('instagram.com/').pop().replace(/\//g, '');
    }
    return clean.replace('@', '');
  })
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'Formato de usuário do Instagram inválido',
  })
  instagram?: string;
}
