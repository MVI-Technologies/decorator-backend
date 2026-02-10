import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../../../common/enums/role.enum';

/**
 * DTO para cadastro de novo usuário.
 */
export class SignUpDto {
  @ApiProperty({ description: 'Nome completo do usuário', example: 'João Silva' })
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Email do usuário', example: 'joao@email.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @ApiProperty({ description: 'Senha (mínimo 6 caracteres)', example: 'senha123' })
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  password: string;

  @ApiProperty({
    description: 'Role do usuário na plataforma',
    enum: [Role.CLIENT, Role.PROFESSIONAL],
    example: Role.CLIENT,
  })
  @IsEnum([Role.CLIENT, Role.PROFESSIONAL], {
    message: 'A role deve ser CLIENT ou PROFESSIONAL',
  })
  role: Role.CLIENT | Role.PROFESSIONAL;

  @ApiPropertyOptional({ description: 'Telefone', example: '(11) 99999-9999' })
  @IsOptional()
  @IsString()
  phone?: string;
}
