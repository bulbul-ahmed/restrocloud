import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { AnalyticsExportService } from './analytics-export.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/plan-feature.decorator';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { ExportQueryDto } from './dto/export-query.dto';

@ApiTags('analytics')
@Controller('restaurants/:restaurantId/analytics')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PlanGuard)
@RequireFeature('analytics')
@Roles(UserRole.MANAGER)
@ApiBearerAuth('access-token')
@ApiParam({ name: 'restaurantId', description: 'Restaurant UUID' })
export class AnalyticsController {
  constructor(
    private analyticsService: AnalyticsService,
    private exportService: AnalyticsExportService,
  ) {}

  // ─── M19.8 CSV Export ─────────────────────────────────────────────────────

  @Get('export')
  @ApiOperation({ summary: 'Download analytics as CSV for a date range (MANAGER+)' })
  async exportCsv(
    @Param('restaurantId') restaurantId: string,
    @CurrentTenant() tenantId: string,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.generateCsvReport(tenantId, restaurantId, query);
    const filename = `report-${query.dateFrom ?? 'all'}-${query.dateTo ?? 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  // ─── M9.1 Dashboard KPIs ──────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({
    summary: 'Today\'s KPIs: revenue, orders, avg order value, new customers, active sessions, pending orders, vs yesterday (MANAGER+)',
  })
  getDashboard(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.analyticsService.getDashboard(tenantId, restaurantId);
  }

  // ─── M9.2 Revenue by day ──────────────────────────────────────────────────

  @Get('revenue')
  @ApiOperation({ summary: 'Daily revenue breakdown for date range. Defaults to last 30 days. (MANAGER+)' })
  getRevenueByDay(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getRevenueByDay(tenantId, restaurantId, query);
  }

  // ─── M9.3 Orders by channel ───────────────────────────────────────────────

  @Get('orders/by-channel')
  @ApiOperation({ summary: 'Order count and revenue broken down by channel (DINE_IN, TAKEAWAY, etc.) (MANAGER+)' })
  getOrdersByChannel(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getOrdersByChannel(tenantId, restaurantId, query);
  }

  // ─── M9.4 Top selling items ───────────────────────────────────────────────

  @Get('menu/top-items')
  @ApiOperation({ summary: 'Top N items by quantity sold and revenue. Default limit=10. (MANAGER+)' })
  getTopItems(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getTopItems(tenantId, restaurantId, query);
  }

  // ─── M9.5 Orders by status ────────────────────────────────────────────────

  @Get('orders/by-status')
  @ApiOperation({ summary: 'Order counts and percentages broken down by status (MANAGER+)' })
  getOrdersByStatus(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getOrdersByStatus(tenantId, restaurantId, query);
  }

  // ─── M9.6 Payments by method ──────────────────────────────────────────────

  @Get('payments/by-method')
  @ApiOperation({ summary: 'Payment breakdown by method: count, revenue, percentage (MANAGER+)' })
  getPaymentsByMethod(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getPaymentsByMethod(tenantId, restaurantId, query);
  }

  // ─── M9.7 Customer overview ───────────────────────────────────────────────

  @Get('customers/overview')
  @ApiOperation({ summary: 'New vs total customers, top spenders by revenue (MANAGER+)' })
  getCustomerOverview(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getCustomerOverview(tenantId, restaurantId, query);
  }

  // ─── M9.8 Staff activity ──────────────────────────────────────────────────

  @Get('staff/activity')
  @ApiOperation({ summary: 'Orders and revenue per staff member, sorted by revenue (MANAGER+)' })
  getStaffActivity(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getStaffActivity(tenantId, restaurantId, query);
  }

  // ─── M9.9 Hourly heatmap ──────────────────────────────────────────────────

  @Get('orders/hourly')
  @ApiOperation({ summary: '24-hour sales heatmap: orders and revenue per hour, with peak hour (MANAGER+)' })
  getHourlySales(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getHourlySales(tenantId, restaurantId, query);
  }

  // ─── M9.10 Period comparison ──────────────────────────────────────────────

  @Get('compare')
  @ApiOperation({
    summary: 'Compare current period vs previous period of same duration: revenue, orders, avgOrderValue, newCustomers with % change (MANAGER+)',
  })
  comparePeriods(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.comparePeriods(tenantId, restaurantId, query);
  }
}
