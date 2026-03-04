import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Service wrapper para o Supabase SDK.
 * Gerencia a instância do client e expõe métodos de Auth e Storage.
 */
@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('supabase.url');
    const anonKey = this.configService.get<string>('supabase.anonKey');
    const serviceRoleKey = this.configService.get<string>('supabase.serviceRoleKey');

    if (!url || !anonKey || !serviceRoleKey) {
      this.logger.warn('Supabase credentials não configuradas. Verifique o .env');
    }

    // Client público (para operações do usuário)
    this.client = createClient(url || '', anonKey || '');

    // Client admin (para operações privilegiadas como deletar usuários)
    this.adminClient = createClient(url || '', serviceRoleKey || '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /** Retorna o client público do Supabase */
  getClient(): SupabaseClient {
    return this.client;
  }

  /** Retorna o client admin do Supabase (service role) */
  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }

  /**
   * Cadastra um novo usuário no Supabase Auth.
   */
  async signUp(email: string, password: string) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
    });

    if (error) {
      this.logger.error(`Erro no signup: ${error.message}`);
      throw error;
    }

    return data;
  }

  /**
   * Autentica um usuário existente.
   */
  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      this.logger.error(`Erro no signin: ${error.message}`);
      throw error;
    }

    return data;
  }

  /**
   * Envia email de recuperação de senha.
   */
  async resetPassword(email: string, frontendUrl: string) {
    const redirectTo = `${frontendUrl}/redefinir-senha`;
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      this.logger.error(`Erro no reset password: ${error.message}`);
      throw error;
    }

    return { message: 'Email de recuperação enviado com sucesso' };
  }

  /**
   * Obtém o usuário a partir do token JWT (via admin client).
   */
  async getUserByToken(token: string) {
    const { data, error } = await this.adminClient.auth.getUser(token);

    if (error) {
      this.logger.error(`Erro ao obter usuário: ${error.message}`);
      throw error;
    }

    return data.user;
  }
}
