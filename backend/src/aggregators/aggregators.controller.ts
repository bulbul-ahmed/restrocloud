import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AggregatorsService } from './aggregators.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { RejectAggregatorOrderDto } from './dto/reject-aggregator-order.dto';
import { AggregatorReportQueryDto } from './dto/aggregator-report.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/plan-feature.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';

@ApiTags('aggregators')
@Controller('restaurants/:restaurantId/aggregators')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PlanGuard)
@RequireFeature('aggregators')
@ApiBearerAuth('access-token')
export class AggregatorsController {
  constructor(private readonly svc: AggregatorsService) {}

  // ─── M17.1 Supported platforms ────────────────────────────────────────────

  @Get('platforms')
  @ApiOperation({ summary: 'List supported aggregator platforms (M17.1)' })
  getPlatforms() {
    return this.svc.getSupportedPlatforms();
  }

  // ─── M17.17 Connection management ─────────────────────────────────────────

  @Post('connections')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Create aggregator connection (M17.17)' })
  createConnection(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CreateConnectionDto,
  ) {
    return this.svc.createConnection(tenantId, restaurantId, dto);
  }

  @Get('connections')
  @ApiOperation({ summary: 'List aggregator connections for restaurant (M17.17)' })
  listConnections(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.svc.listConnections(tenantId, restaurantId);
  }

  @Get('connections/:connectionId')
  @ApiOperation({ summary: 'Get aggregator connection detail (M17.17)' })
  getConnection(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('connectionId') connectionId: string,
  ) {
    return this.svc.getConnection(tenantId, restaurantId, connectionId);
  }

  @Patch('connections/:connectionId')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update aggregator connection (M17.17)' })
  updateConnection(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('connectionId') connectionId: string,
    @Body() dto: UpdateConnectionDto,
  ) {
    return this.svc.updateConnection(tenantId, restaurantId, connectionId, dto);
  }

  @Delete('connections/:connectionId')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete aggregator connection (OWNER only) (M17.17)' })
  deleteConnection(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('connectionId') connectionId: string,
  ) {
    return this.svc.deleteConnection(tenantId, restaurantId, connectionId);
  }

  @Post('connections/:connectionId/test')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Test aggregator API credentials (M17.17)' })
  testConnection(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('connectionId') connectionId: string,
  ) {
    return this.svc.testConnection(tenantId, restaurantId, connectionId);
  }

  // ─── M17.9 Accept / reject aggregator orders ──────────────────────────────

  @Patch('orders/:orderId/accept')
  @Roles(UserRole.MANAGER)
  @ApiOperation({
    summary: 'Accept a PENDING aggregator order + notify platform (M17.9)',
  })
  acceptOrder(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.svc.acceptAggregatorOrder(tenantId, restaurantId, orderId);
  }

  @Patch('orders/:orderId/reject')
  @Roles(UserRole.MANAGER)
  @ApiOperation({
    summary: 'Reject a PENDING aggregator order with reason code + notify platform (M17.9)',
  })
  rejectOrder(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
    @Body() dto: RejectAggregatorOrderDto,
  ) {
    return this.svc.rejectAggregatorOrder(tenantId, restaurantId, orderId, dto);
  }

  // ─── M17.12 / M17.4 / M17.7 Menu sync ────────────────────────────────────

  @Post('connections/:connectionId/sync-menu')
  @Roles(UserRole.MANAGER)
  @ApiOperation({
    summary: 'Push menu items + availability to a specific aggregator (M17.4/M17.7/M17.12)',
  })
  syncMenu(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('connectionId') connectionId: string,
  ) {
    return this.svc.syncMenuToConnection(tenantId, restaurantId, connectionId);
  }

  @Post('sync-all-menus')
  @Roles(UserRole.MANAGER)
  @ApiOperation({
    summary: 'Push menu to ALL active aggregators simultaneously (M17.12)',
  })
  syncAllMenus(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
  ) {
    return this.svc.syncAllMenus(tenantId, restaurantId);
  }

  // ─── M17.13 Hours sync ────────────────────────────────────────────────────

  @Post('connections/:connectionId/sync-hours')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Push operating hours to aggregator (M17.13)' })
  syncHours(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('connectionId') connectionId: string,
  ) {
    return this.svc.syncHoursToConnection(tenantId, restaurantId, connectionId);
  }

  // ─── M17.14 Commission tracking ───────────────────────────────────────────

  @Get('connections/:connectionId/commission')
  @ApiOperation({ summary: 'Commission tracking report for an aggregator (M17.14)' })
  getCommissionReport(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('connectionId') connectionId: string,
    @Query() query: AggregatorReportQueryDto,
  ) {
    return this.svc.getCommissionReport(
      tenantId,
      restaurantId,
      connectionId,
      query.fromDate,
      query.toDate,
    );
  }

  // ─── M17.15 Revenue comparison ────────────────────────────────────────────

  @Get('revenue-report')
  @ApiOperation({ summary: 'Revenue + commission comparison across all aggregators (M17.15)' })
  getRevenueComparison(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: AggregatorReportQueryDto,
  ) {
    return this.svc.getRevenueComparison(
      tenantId,
      restaurantId,
      query.fromDate,
      query.toDate,
    );
  }
}
