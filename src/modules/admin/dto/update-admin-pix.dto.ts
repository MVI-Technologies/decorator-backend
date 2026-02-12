import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Tipos de chave PIX (BACEN) */
export enum PixKeyType {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  RANDOM = 'RANDOM',
}

/**
 * DTO para configurar a chave PIX do admin (recebimento de pagamentos MVP).
 */
export class UpdateAdminPixDto {
  @ApiProperty({
    description: 'Chave PIX do admin do sistema (CPF, e-mail, telefone, etc.)',
    example: 'admin@decorador.net',
  })
  @IsNotEmpty({ message: 'A chave PIX é obrigatória' })
  @IsString()
  pixKey: string;

  @ApiProperty({
    description: 'Tipo da chave PIX',
    enum: PixKeyType,
    example: PixKeyType.EMAIL,
  })
  @IsEnum(PixKeyType, { message: 'Tipo de chave PIX inválido' })
  pixKeyType: PixKeyType;
}
