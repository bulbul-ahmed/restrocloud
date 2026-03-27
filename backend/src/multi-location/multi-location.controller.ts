import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/plan-feature.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { MultiLocationService } from './multi-location.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { SetPriceOverrideDto } from './dto/price-override.dto';
import { CreateStockTransferDto, ReceiveTransferDto } from './dto/stock-transfer.dto';
import { ConsolidatedQueryDto } from './dto/consolidated-query.dto';

@ApiTags('Multi-Location')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PlanGuard)
@RequireFeature('multiLocation')
@Roles(UserRole.OWNER)
@Controller('tenant')
export class MultiLocationController {
  constructor(private svc: MultiLocationService) {}

  // ── M24.1 — Location CRUD ─────────────────────────────────────────────────

  @Get('locations')
  @ApiOperation({ summary: 'M24.1 — List all locations in tenant' })
  listLocations(@CurrentUser() user: any) {
    return this.svc.listLocations(user.tenantId);
  }

  @Post('locations')
  @ApiOperation({ summary: 'M24.1 — Create new restaurant location' })
  createLocation(@CurrentUser() user: any, @Body() dto: CreateLocationDto) {
    return this.svc.createLocation(user.tenantId, dto);
  }

  @Patch('locations/:restaurantId/activate')
  @ApiOperation({ summary: 'M24.1 — Activate a location' })
  activateLocation(
    @CurrentUser() user: any,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    return this.svc.toggleLocationActive(user.tenantId, restaurantId, true);
  }

  @Patch('locations/:restaurantId/deactivate')
  @ApiOperation({ summary: 'M24.1 — Deactivate a location' })
  deactivateLocation(
    @CurrentUser() user: any,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    return this.svc.toggleLocationActive(user.tenantId, restaurantId, false);
  }

  // ── M24.2 — Consolidated dashboard ───────────────────────────────────────

  @Get('analytics/consolidated')
  @ApiOperation({ summary: 'M24.2 — Consolidated today KPIs across all locations' })
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getConsolidated(@CurrentUser() user: any) {
    return this.svc.getConsolidatedDashboard(user.tenantId);
  }

  // ── M24.3 — Location comparison / leaderboard ─────────────────────────────

  @Get('analytics/comparison')
  @ApiOperation({ summary: 'M24.3 — Compare performance across all locations' })
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getComparison(@CurrentUser() user: any, @Query() q: ConsolidatedQueryDto) {
    return this.svc.getLocationComparison(user.tenantId, q);
  }

  // ── M24.4 — Global menu & price overrides ────────────────────────────────

  @Get('menu/global')
  @ApiOperation({ summary: 'M24.4 — All menu items across all tenant locations' })
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getGlobalMenu(@CurrentUser() user: any) {
    return this.svc.getGlobalMenu(user.tenantId);
  }

  @Post('menu/price-overrides')
  @ApiOperation({ summary: 'M24.4 — Set per-location price override for a menu item' })
  setPriceOverride(@CurrentUser() user: any, @Body() dto: SetPriceOverrideDto) {
    return this.svc.setPriceOverride(user.tenantId, dto);
  }

  @Get('menu/price-overrides')
  @ApiOperation({ summary: 'M24.4 — List all price overrides (optionally filtered by restaurant)' })
  @ApiQuery({ name: 'restaurantId', required: false })
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  listPriceOverrides(@CurrentUser() user: any, @Query('restaurantId') restaurantId?: string) {
    return this.svc.listPriceOverrides(user.tenantId, restaurantId);
  }

  @Delete('menu/price-overrides/:id')
  @ApiOperation({ summary: 'M24.4 — Remove a price override' })
  deletePriceOverride(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.deletePriceOverride(user.tenantId, id);
  }

  // ── M24.5 — Stock transfers ───────────────────────────────────────────────

  @Post('stock-transfers')
  @ApiOperation({ summary: 'M24.5 — Initiate inter-location stock transfer' })
  createTransfer(@CurrentUser() user: any, @Body() dto: CreateStockTransferDto) {
    return this.svc.createStockTransfer(user.tenantId, user.id, dto);
  }

  @Get('stock-transfers')
  @ApiOperation({ summary: 'M24.5 — List stock transfers (filter by restaurantId or status)' })
  @ApiQuery({ name: 'restaurantId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'RECEIVED', 'CANCELLED'] })
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  listTransfers(
    @CurrentUser() user: any,
    @Query('restaurantId') restaurantId?: string,
    @Query('status') status?: any,
  ) {
    return this.svc.listStockTransfers(user.tenantId, { restaurantId, status });
  }

  @Patch('stock-transfers/:id/receive')
  @ApiOperation({ summary: 'M24.5 — Receive a stock transfer at destination' })
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  receiveTransfer(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveTransferDto,
  ) {
    return this.svc.receiveStockTransfer(user.tenantId, id, user.id, dto);
  }

  @Patch('stock-transfers/:id/cancel')
  @ApiOperation({ summary: 'M24.5 — Cancel a pending stock transfer' })
  cancelTransfer(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.cancelStockTransfer(user.tenantId, id, user.id);
  }

  // ── M24.7 — Cross-location staff ─────────────────────────────────────────

  @Get('staff')
  @ApiOperation({ summary: 'M24.7 — All staff across all locations in tenant' })
  getAllStaff(@CurrentUser() user: any) {
    return this.svc.getAllStaff(user.tenantId);
  }

  @Patch('staff/:userId/assign')
  @ApiOperation({ summary: 'M24.7 — Assign staff member to a specific location' })
  @ApiQuery({ name: 'restaurantId', required: true })
  assignStaff(
    @CurrentUser() user: any,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('restaurantId') restaurantId: string,
  ) {
    return this.svc.assignStaffToLocation(user.tenantId, userId, restaurantId);
  }
}
