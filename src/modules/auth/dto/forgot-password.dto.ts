import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para recuperação de senha.
 */
export class ForgotPasswordDto {
  @ApiProperty({ description: 'Email cadastrado', example: 'joao@email.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;
}
