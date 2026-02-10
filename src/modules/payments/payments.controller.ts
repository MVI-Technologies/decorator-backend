import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { RequestWithdrawalDto } from './dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

/**
 * Controller de Pagamentos e Saques.
 */
@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * GET /api/v1/payments/balance — Saldo do profissional
   */
  @Get('balance')
  @Roles(Role.PROFESSIONAL)
  @ApiOperation({ summary: 'Consultar saldo disponível' })
  async getBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getBalance(user.id);
  }

  /**
   * POST /api/v1/payments/withdraw — Solicitar saque
   */
  @Post('withdraw')
  @Roles(Role.PROFESSIONAL)
  @ApiOperation({ summary: 'Solicitar saque do saldo disponível' })
  async requestWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestWithdrawalDto,
  ) {
    return this.paymentsService.requestWithdrawal(user.id, dto);
  }

  /**
   * GET /api/v1/payments/withdrawals — Histórico de saques
   */
  @Get('withdrawals')
  @Roles(Role.PROFESSIONAL)
  @ApiOperation({ summary: 'Listar histórico de saques' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getWithdrawalHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.paymentsService.getWithdrawalHistory(user.id, page, limit);
  }
}
