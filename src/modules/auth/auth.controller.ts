import { Controller, Post, Patch, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignUpDto, SignInDto, ForgotPasswordDto, ResetPasswordDto } from './dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

/**
 * Controller de autenticação.
 * Endpoints públicos para cadastro, login e recuperação de senha.
 * Endpoint protegido para obter perfil do usuário logado.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/signup
   * Cadastro de novo usuário (CLIENT ou PROFESSIONAL).
   */
  @Public()
  @Post('signup')
  @ApiOperation({ summary: 'Cadastrar novo usuário' })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso' })
  @ApiResponse({ status: 409, description: 'Email já cadastrado' })
  async signUp(@Body() dto: SignUpDto) {
    return this.authService.signUp(dto);
  }

  /**
   * POST /api/v1/auth/signin
   * Login com email e senha.
   */
  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login do usuário' })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  async signIn(@Body() dto: SignInDto) {
    return this.authService.signIn(dto);
  }

  /**
   * POST /api/v1/auth/forgot-password
   * Solicitar recuperação de senha.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recuperação de senha' })
  @ApiResponse({ status: 200, description: 'Email de recuperação enviado' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * PATCH /api/v1/auth/reset-password
   * Redefine a senha usando o token recebido por email.
   */
  @Public()
  @Patch('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefinir senha com token do email' })
  @ApiResponse({ status: 200, description: 'Senha redefinida com sucesso' })
  @ApiResponse({ status: 400, description: 'Token inválido ou expirado' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.updatePassword(dto);
  }

  /**
   * GET /api/v1/auth/me
   * Retorna o perfil do usuário autenticado.
   */
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Obter perfil do usuário logado' })
  @ApiResponse({ status: 200, description: 'Perfil retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }
}
