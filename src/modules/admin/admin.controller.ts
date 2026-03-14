import { Controller, Get, Patch, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import {
  UpdateProfessionalStatusDto,
  ProcessWithdrawalDto,
  UpdateAdminPixDto,
} from './dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

/**
 * Controller Admin.
 * Todos os endpoints requerem role ADMIN.
 */
@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard com métricas da plataforma (quantidades para os cards)' })
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('projects')
  @ApiOperation({ summary: 'Listar todos os projetos (projeto, cliente, profissional, status do pagamento)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getProjects(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getProjects(page, limit);
  }

  @Get('professionals/pending')
  @ApiOperation({ summary: 'Listar profissionais pendentes de aprovação' })
  async getPendingProfessionals() {
    return this.adminService.getPendingProfessionals();
  }

  @Patch('professionals/:id/status')
  @ApiOperation({ summary: 'Aprovar/rejeitar/suspender profissional' })
  async updateProfessionalStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProfessionalStatusDto,
  ) {
    return this.adminService.updateProfessionalStatus(id, dto);
  }

  @Get('withdrawals/pending')
  @ApiOperation({ summary: 'Listar saques pendentes' })
  async getPendingWithdrawals() {
    return this.adminService.getPendingWithdrawals();
  }

  @Patch('withdrawals/:id/process')
  @ApiOperation({ summary: 'Processar saque (aprovar/rejeitar)' })
  async processWithdrawal(
    @Param('id') id: string,
    @Body() dto: ProcessWithdrawalDto,
  ) {
    return this.adminService.processWithdrawal(id, dto);
  }

  @Get('users')
  @ApiOperation({ summary: 'Listar todos os usuários' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getUsers(page, limit);
  }

  @Patch('users/:id/toggle-active')
  @ApiOperation({ summary: 'Ativar/desativar usuário' })
  async toggleUserActive(@Param('id') id: string) {
    return this.adminService.toggleUserActive(id);
  }

  // ─── Chave PIX do admin (MVP: cliente paga via PIX para o admin) ───

  @Get('settings/pix')
  @ApiOperation({ summary: 'Obter chave PIX configurada do admin' })
  async getAdminPixSettings() {
    return this.adminService.getAdminPixSettings();
  }

  @Patch('settings/pix')
  @ApiOperation({ summary: 'Configurar chave PIX do admin para receber pagamentos' })
  async updateAdminPixSettings(@Body() dto: UpdateAdminPixDto) {
    return this.adminService.updateAdminPixSettings(dto);
  }

  // ─── Configurações da Plataforma (Taxas e Mensalidades) ───

  @Get('settings/platform')
  @ApiOperation({ summary: 'Obter configurações de negócio da plataforma (mensalidade e taxa admin)' })
  async getPlatformConfigs() {
    return this.adminService.getPlatformConfigs();
  }

  @Patch('settings/platform')
  @ApiOperation({ summary: 'Atualizar configurações de negócio da plataforma' })
  async updatePlatformConfigs(@Body() dto: { professionalMonthlyFee?: number; platformFeePercentage?: number }) {
    return this.adminService.updatePlatformConfigs(dto);
  }

  // ─── Pagamentos MVP (recebimento e repasse ao profissional) ───

  @Get('payments/pending-received')
  @ApiOperation({ summary: 'Pagamentos aguardando confirmação de recebimento (PIX do cliente)' })
  async getPaymentsPendingReceived() {
    return this.adminService.getPaymentsPendingReceived();
  }

  @Patch('payments/:id/mark-received')
  @ApiOperation({ summary: 'Marcar que o admin recebeu o PIX do cliente' })
  async markPaymentReceived(@Param('id') id: string) {
    return this.adminService.markPaymentReceived(id);
  }

  @Get('payments/pending-transfer')
  @ApiOperation({ summary: 'Pagamentos recebidos que ainda não foram repassados ao profissional (4 dias úteis)' })
  async getPaymentsPendingTransferToProfessional() {
    return this.adminService.getPaymentsPendingTransferToProfessional();
  }

  @Patch('payments/:id/mark-paid-to-professional')
  @ApiOperation({ summary: 'Marcar que o admin já repassou o valor ao profissional' })
  async markPaymentPaidToProfessional(@Param('id') id: string) {
    return this.adminService.markPaymentPaidToProfessional(id);
  }
}
