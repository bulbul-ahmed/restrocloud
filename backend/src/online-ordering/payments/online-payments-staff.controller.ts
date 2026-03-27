import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { OnlinePaymentsService } from './online-payments.service';
import { OnlinePaymentAnalyticsQueryDto } from './dto/online-payment-analytics-query.dto';

/**
 * Staff-facing online payments endpoints — JWT + TenantGuard required.
 * Base: /restaurants/:restaurantId
 */
@ApiTags('online-payments')
@Controller('restaurants/:restaurantId')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
@ApiParam({ name: 'restaurantId', description: 'Restaurant UUID' })
export class OnlinePaymentsStaffController {
  constructor(private readonly svc: OnlinePaymentsService) {}

  // ─── M14.10 Online payment analytics ────────────────────────────────────
  @Get('online-payments/analytics')
  @ApiOperation({
    summary: 'Online payment analytics: gateway breakdown, conversion rate, revenue (MANAGER+)',
  })
  getOnlinePaymentAnalytics(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: OnlinePaymentAnalyticsQueryDto,
  ) {
    return this.svc.getOnlinePaymentAnalytics(tenantId, restaurantId, query);
  }
}
