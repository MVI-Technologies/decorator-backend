import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from './supabase.service';
import { SignUpDto, SignInDto, ForgotPasswordDto } from './dto';
import { Role } from '../../common/enums/role.enum';

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

        // 3. Criar perfil conforme a role
        if (dto.role === Role.CLIENT) {
          await tx.clientProfile.create({
            data: { userId: newUser.id },
          });
        } else if (dto.role === Role.PROFESSIONAL) {
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
      await this.supabaseService.resetPassword(dto.email);
      return { message: 'Se o email existir, um link de recuperação será enviado.' };
    } catch (error) {
      this.logger.error(`Erro no reset: ${(error as Error).message}`);
      // Não revelar se o email existe ou não (segurança)
      return { message: 'Se o email existir, um link de recuperação será enviado.' };
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

    // Remover campos sensíveis
    const { supabaseAuthId, ...safeUser } = user;
    return safeUser;
  }
}
