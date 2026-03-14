import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from './supabase.service';
import { SignUpDto, SignInDto, ForgotPasswordDto, ResetPasswordDto } from './dto';
import { Role } from '../../common/enums/role.enum';
import { toAbsoluteAvatarUrl } from '../../common/utils/avatar-url.util';

/**
 * Service de autenticação.
 * Orquestra o Supabase Auth e o Prisma para gerenciar
 * o ciclo de vida do usuário (cadastro, login, perfil).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Cadastra um novo usuário.
   * 1. Cria no Supabase Auth
   * 2. Cria User no banco via Prisma
   * 3. Cria ClientProfile ou ProfessionalProfile conforme a role
   */
  async signUp(dto: SignUpDto) {
    // Verificar se o email já existe no banco
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Este email já está cadastrado');
    }

    try {
      // 1. Criar no Supabase Auth
      const supabaseData = await this.supabaseService.signUp(dto.email, dto.password);

      if (!supabaseData.user) {
        throw new InternalServerErrorException('Erro ao criar usuário no Supabase');
      }

      // 2. Criar User no banco + perfil adequado (transação atômica)
      const user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            supabaseAuthId: supabaseData.user!.id,
            email: dto.email,
            name: dto.name,
            phone: dto.phone,
            role: dto.role,
          },
        });

        // 3. Criar perfil conforme a role (com publicId sequencial)
        if (dto.role === Role.CLIENT) {
          const clientCount = await tx.clientProfile.count();
          await tx.clientProfile.create({
            data: {
              userId: newUser.id,
            },
          });
        } else if (dto.role === Role.PROFESSIONAL) {
          const professionalCount = await tx.professionalProfile.count();
          await tx.professionalProfile.create({
            data: {
              userId: newUser.id,
              displayName: dto.name,
            },
          });
        }

        return newUser;
      });

      this.logger.log(`Usuário criado: ${user.email} (${user.role})`);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        accessToken: supabaseData.session?.access_token,
      };
    } catch (error) {
      // Se o erro já é uma exceção HTTP, re-lançar
      if (error instanceof ConflictException) throw error;

      this.logger.error(`Erro no signup: ${(error as Error).message}`);
      throw new InternalServerErrorException('Erro ao criar conta. Tente novamente.');
    }
  }

  /**
   * Autentica um usuário existente.
   */
  async signIn(dto: SignInDto) {
    try {
      const supabaseData = await this.supabaseService.signIn(dto.email, dto.password);

      if (!supabaseData.user || !supabaseData.session) {
        throw new UnauthorizedException('Credenciais inválidas');
      }

      // Buscar dados do usuário no banco
      const user = await this.prisma.user.findUnique({
        where: { supabaseAuthId: supabaseData.user.id },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Usuário não encontrado ou inativo');
      }

      this.logger.log(`Login: ${user.email}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        accessToken: supabaseData.session.access_token,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;

      const err = error as Error & { cause?: { code?: string } };
      const message = err.message ?? '';
      this.logger.error(`Erro no signin: ${message}`);

      // Supabase exige confirmação de email por padrão
      if (message?.toLowerCase().includes('email not confirmed')) {
        throw new UnauthorizedException(
          'Confirme seu email antes de fazer login. Verifique a caixa de entrada e o spam.',
        );
      }

      // Timeout ou falha de rede ao falar com o Supabase
      if (
        message?.toLowerCase().includes('fetch failed') ||
        err.cause?.code === 'UND_ERR_CONNECT_TIMEOUT'
      ) {
        throw new UnauthorizedException(
          'Não foi possível conectar ao servidor de autenticação. Verifique sua internet e tente novamente.',
        );
      }

      throw new UnauthorizedException('Credenciais inválidas');
    }
  }

  /**
   * Envia email de recuperação de senha.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    try {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
      await this.supabaseService.resetPassword(dto.email, frontendUrl);
      return { message: 'Se o email existir, um link de recuperação será enviado.' };
    } catch (error) {
      this.logger.error(`Erro no reset: ${(error as Error).message}`);
      return { message: 'Se o email existir, um link de recuperação será enviado.' };
    }
  }

  /**
   * Redefine a senha do usuário usando o accessToken recebido no link do email.
   */
  async updatePassword(dto: ResetPasswordDto) {
    try {
      // Decodificar o payload do JWT sem validar assinatura/expiração
      // O token de recuperação do Supabase contém o sub (userId) que precisamos
      const parts = dto.accessToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Token inválido');
      }
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as { sub?: string };

      const supabaseUserId = payload.sub;
      if (!supabaseUserId) {
        throw new Error('Token sem identificação de usuário');
      }

      const { data, error } = await this.supabaseService
        .getAdminClient()
        .auth.admin.updateUserById(supabaseUserId, { password: dto.newPassword });

      if (error || !data) {
        throw new Error(error?.message ?? 'Erro ao redefinir senha');
      }

      return { message: 'Senha redefinida com sucesso! Faça login com sua nova senha.' };
    } catch (error) {
      this.logger.error(`Erro ao redefinir senha: ${(error as Error).message}`);
      throw new Error('Token inválido ou expirado. Solicite um novo link de recuperação.');
    }
  }

  /**
   * Retorna o perfil completo do usuário autenticado.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        clientProfile: true,
        professionalProfile: {
          include: {
            styles: true,
            portfolioItems: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    // Remover campos sensíveis e normalizar avatarUrl (relativa → absoluta)
    const { supabaseAuthId, ...safeUser } = user;
    const baseUrl = this.configService.get<string>('APP_URL');
    safeUser.avatarUrl = toAbsoluteAvatarUrl(safeUser.avatarUrl, baseUrl) ?? null;
    return safeUser;
  }
}
