import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { IssueRefundDto } from './dto/issue-refund.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';

// ─── PaymentsController — /restaurants/:restaurantId/payments ────────────────

@ApiTags('payments')
@Controller('restaurants/:restaurantId/payments')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
@ApiParam({ name: 'restaurantId', description: 'Restaurant UUID' })
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // ─── M7.9 Summary (static route — before :paymentId) ─────────────────────

  @Get('summary')
  @ApiOperation({ summary: 'Payment summary: gross, net, refunds, breakdown by method (defaults to today)' })
  getSummary(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.paymentsService.getPaymentSummary(tenantId, restaurantId, { dateFrom, dateTo });
  }

  // ─── M7.4 List all payments ───────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List restaurant payments with filters (status, method, date range, pagination)' })
  listPayments(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: ListPaymentsQueryDto,
  ) {
    return this.paymentsService.listPayments(tenantId, restaurantId, query);
  }

  // ─── M7.5 Get payment detail ──────────────────────────────────────────────

  @Get(':paymentId')
  @ApiOperation({ summary: 'Get payment detail with refunds and transaction records' })
  getPayment(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.paymentsService.getPayment(tenantId, restaurantId, paymentId);
  }

  // ─── M14.6 Approve online refund request (MANAGER+) ─────────────────────

  @Patch(':paymentId/refunds/:refundId/approve')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve a customer-submitted online refund request (MANAGER+)' })
  approveOnlineRefund(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('paymentId') paymentId: string,
    @Param('refundId') refundId: string,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.approveOnlineRefund(
      tenantId,
      restaurantId,
      paymentId,
      refundId,
      user.role as UserRole,
    );
  }

  // ─── M7.7 Cancel payment ─────────────────────────────────────────────────

  @Patch(':paymentId/cancel')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Cancel a PENDING/PROCESSING payment (MANAGER+)' })
  cancelPayment(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.cancelPayment(tenantId, restaurantId, paymentId, user.role as UserRole);
  }

  // ─── M7.6 Issue refund ────────────────────────────────────────────────────

  @Post(':paymentId/refunds')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Issue a full or partial refund (MANAGER+). Updates payment status accordingly.' })
  @ApiResponse({ status: 201, description: 'Refund issued' })
  issueRefund(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: any,
    @Body() dto: IssueRefundDto,
  ) {
    return this.paymentsService.issueRefund(tenantId, restaurantId, paymentId, user.role as UserRole, dto);
  }

  // ─── M7.8 List refunds for payment ───────────────────────────────────────

  @Get(':paymentId/refunds')
  @ApiOperation({ summary: 'List all refunds for a payment' })
  listRefunds(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.paymentsService.listRefunds(tenantId, restaurantId, paymentId);
  }
}

// ─── OrderPaymentsController — /restaurants/:restaurantId/orders/:orderId/payments ──

@ApiTags('payments')
@Controller('restaurants/:restaurantId/orders/:orderId/payments')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
@ApiParam({ name: 'restaurantId', description: 'Restaurant UUID' })
@ApiParam({ name: 'orderId', description: 'Order UUID' })
export class OrderPaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // ─── M14.4 Confirm COD payment collected (CASHIER+) ─────────────────────

  @Patch('cod/confirm')
  @Roles(UserRole.CASHIER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm COD cash collected — moves order to COMPLETED (CASHIER+)' })
  confirmCodPayment(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.confirmCodPayment(tenantId, restaurantId, orderId, user.role as UserRole);
  }

  // ─── M7.1 + M7.2 Process payment (single or split) ───────────────────────

  @Post()
  @Roles(UserRole.CASHIER)
  @ApiOperation({
    summary:
      'Process a payment for an order (CASHIER+). Call multiple times for split payment. Method: CASH | CARD | MOBILE_BANKING | ONLINE | WALLET | CREDIT.',
  })
  @ApiResponse({ status: 201, description: 'Payment processed' })
  processPayment(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
    @Body() dto: ProcessPaymentDto,
  ) {
    return this.paymentsService.processPayment(
      tenantId,
      restaurantId,
      orderId,
      user.id,
      user.role as UserRole,
      dto,
    );
  }

  // ─── M7.3 List payments for order ────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all payments for an order with paid/outstanding summary' })
  listOrderPayments(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.listOrderPayments(tenantId, restaurantId, orderId);
  }
}
