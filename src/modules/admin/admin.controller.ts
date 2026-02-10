import { Controller, Get, Patch, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UpdateProfessionalStatusDto, ProcessWithdrawalDto } from './dto';
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
  @ApiOperation({ summary: 'Dashboard com métricas da plataforma' })
  async getDashboard() {
    return this.adminService.getDashboard();
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
}
