import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Access token recebido no link do email' })
  @IsString()
  accessToken: string;

  @ApiProperty({ description: 'Nova senha', example: 'NovaSenha@123' })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter ao menos 6 caracteres' })
  newPassword: string;
}
