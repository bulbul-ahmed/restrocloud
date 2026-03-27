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
import { DeliveryService } from './delivery.service';
import { CreateDeliveryZoneDto } from './dto/create-delivery-zone.dto';
import { UpdateDeliveryZoneDto } from './dto/update-delivery-zone.dto';
import { CreateDriverDto } from './dto/create-driver.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { UpdateDriverLocationDto } from './dto/update-driver-location.dto';
import { SubmitProofDto } from './dto/submit-proof.dto';
import { ListDeliveriesQueryDto } from './dto/list-deliveries-query.dto';
import { DeliveryAnalyticsQueryDto } from './dto/analytics-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireFeature } from '../common/decorators/plan-feature.decorator';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('delivery')
@Controller('restaurants/:restaurantId/delivery')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PlanGuard)
@RequireFeature('delivery')
@ApiBearerAuth('access-token')
export class DeliveryController {
  constructor(private readonly svc: DeliveryService) {}

  // ────────────────────────────────────────────────────────────────────────────
  // STATIC routes FIRST — must come before :deliveryId catch-all
  // ────────────────────────────────────────────────────────────────────────────

  // M18.2 — Delivery Zones
  @Get('zones')
  @ApiOperation({ summary: 'List delivery zones (M18.2)' })
  listZones(@CurrentTenant() tenantId: string, @Param('restaurantId') restaurantId: string) {
    return this.svc.listZones(tenantId, restaurantId);
  }

  @Post('zones')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Create delivery zone (M18.2)' })
  createZone(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CreateDeliveryZoneDto,
  ) {
    return this.svc.createZone(tenantId, restaurantId, dto);
  }

  // M18.3 — Drivers
  @Get('drivers')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'List drivers with online status (M18.3)' })
  listDrivers(@CurrentTenant() tenantId: string, @Param('restaurantId') restaurantId: string) {
    return this.svc.listDrivers(tenantId, restaurantId);
  }

  @Post('drivers')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Create driver account (M18.3)' })
  createDriver(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CreateDriverDto,
  ) {
    return this.svc.createDriver(tenantId, restaurantId, dto);
  }

  // M18.10 — Analytics (static, before :deliveryId)
  @Get('analytics')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Delivery analytics (M18.10)' })
  getAnalytics(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: DeliveryAnalyticsQueryDto,
  ) {
    return this.svc.getAnalytics(tenantId, restaurantId, query);
  }

  // M18.7 — Driver self-service: my deliveries (static, before :deliveryId)
  @Get('driver/my-deliveries')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Get my active deliveries (driver) (M18.7)' })
  getMyDeliveries(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.getMyDeliveries(tenantId, restaurantId, user.id);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // M18.4 — Create & List Deliveries
  // ────────────────────────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Create delivery for an order (M18.4)' })
  createDelivery(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Body() dto: CreateDeliveryDto,
  ) {
    return this.svc.createDelivery(tenantId, restaurantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List deliveries with filters (M18.4)' })
  listDeliveries(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: ListDeliveriesQueryDto,
  ) {
    return this.svc.listDeliveries(tenantId, restaurantId, query);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // :deliveryId routes
  // ────────────────────────────────────────────────────────────────────────────

  @Get(':deliveryId')
  @ApiOperation({ summary: 'Get delivery detail (M18.4)' })
  getDelivery(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('deliveryId') deliveryId: string,
  ) {
    return this.svc.getDelivery(tenantId, restaurantId, deliveryId);
  }

  // M18.5 — Assign Driver
  @Patch(':deliveryId/assign')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Assign driver to delivery (M18.5)' })
  assignDriver(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('deliveryId') deliveryId: string,
    @Body() dto: AssignDriverDto,
  ) {
    return this.svc.assignDriver(tenantId, restaurantId, deliveryId, dto);
  }

  // M18.6 — Manager status update
  @Patch(':deliveryId/status')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update delivery status (manager state machine) (M18.6)' })
  updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('deliveryId') deliveryId: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.svc.updateStatusByManager(tenantId, restaurantId, deliveryId, dto);
  }

  // M18.7 — Driver status update
  @Patch(':deliveryId/driver/status')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver updates own delivery status (M18.7)' })
  driverUpdateStatus(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('deliveryId') deliveryId: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.updateStatusByDriver(tenantId, restaurantId, deliveryId, dto, user.id);
  }

  // M18.7 — Driver submit proof
  @Post(':deliveryId/driver/proof')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Submit delivery proof (driver) (M18.7)' })
  submitProof(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('deliveryId') deliveryId: string,
    @Body() dto: SubmitProofDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.submitProof(tenantId, restaurantId, deliveryId, dto, user.id);
  }

  // M18.8 — Driver location (POST)
  @Post(':deliveryId/driver/location')
  @Roles(UserRole.DRIVER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update driver GPS location (M18.8)' })
  updateLocation(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('deliveryId') deliveryId: string,
    @Body() dto: UpdateDriverLocationDto,
    @CurrentUser() user: any,
  ) {
    return this.svc.updateDriverLocation(tenantId, restaurantId, deliveryId, dto, user.id);
  }

  // M18.8 — Driver location (GET)
  @Get(':deliveryId/driver/location')
  @ApiOperation({ summary: 'Get driver last known location (M18.8)' })
  getLocation(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('deliveryId') deliveryId: string,
  ) {
    return this.svc.getDriverLocation(tenantId, restaurantId, deliveryId);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // :zoneId / :driverId parameterized routes (keep last)
  // ────────────────────────────────────────────────────────────────────────────

  // M18.2
  @Patch('zones/:zoneId')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update delivery zone (M18.2)' })
  updateZone(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('zoneId') zoneId: string,
    @Body() dto: UpdateDeliveryZoneDto,
  ) {
    return this.svc.updateZone(tenantId, restaurantId, zoneId, dto);
  }

  @Delete('zones/:zoneId')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate delivery zone (soft delete) (M18.2)' })
  deleteZone(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('zoneId') zoneId: string,
  ) {
    return this.svc.deleteZone(tenantId, restaurantId, zoneId);
  }

  // M18.3
  @Patch('drivers/:driverId/toggle')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Toggle driver active/inactive (M18.3)' })
  toggleDriver(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('driverId') driverId: string,
  ) {
    return this.svc.toggleDriver(tenantId, restaurantId, driverId);
  }
}
