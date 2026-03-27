import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { KdsService } from './kds.service';
import { KdsQueueQueryDto } from './dto/kds-queue-query.dto';
import { KdsHistoryQueryDto } from './dto/kds-history-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('KDS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('restaurants/:restaurantId/kds')
export class KdsController {
  constructor(private readonly kds: KdsService) {}

  // ─── M6.1 / M6.10 Queue view (with station filter) ───────────────────────

  @Get('queue')
  @Roles(UserRole.KITCHEN, UserRole.MANAGER, UserRole.OWNER, UserRole.CASHIER, UserRole.WAITER)
  getQueue(
    @CurrentUser() user: any,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query() query: KdsQueueQueryDto,
  ) {
    return this.kds.getQueue(user.tenantId, restaurantId, query);
  }

  // ─── M6.8 History ─────────────────────────────────────────────────────────

  @Get('history')
  @Roles(UserRole.KITCHEN, UserRole.MANAGER, UserRole.OWNER, UserRole.CASHIER, UserRole.WAITER)
  getHistory(
    @CurrentUser() user: any,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query() query: KdsHistoryQueryDto,
  ) {
    return this.kds.getHistory(user.tenantId, restaurantId, query);
  }

  // ─── M6.9 Stats ───────────────────────────────────────────────────────────

  @Get('stats')
  @Roles(UserRole.MANAGER, UserRole.OWNER)
  getStats(
    @CurrentUser() user: any,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    return this.kds.getStats(user.tenantId, restaurantId);
  }

  // ─── M6.2 Acknowledge order ───────────────────────────────────────────────

  @Patch('orders/:orderId/acknowledge')
  @Roles(UserRole.KITCHEN, UserRole.MANAGER, UserRole.OWNER)
  acknowledgeOrder(
    @CurrentUser() user: any,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.kds.acknowledgeOrder(user.tenantId, restaurantId, orderId, user.userId);
  }

  // ─── M6.3 Start cooking ───────────────────────────────────────────────────

  @Patch('orders/:orderId/start')
  @Roles(UserRole.KITCHEN, UserRole.MANAGER, UserRole.OWNER)
  startOrder(
    @CurrentUser() user: any,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.kds.startOrder(user.tenantId, restaurantId, orderId, user.userId);
  }

  // ─── M6.4 Mark individual item ready ─────────────────────────────────────

  @Patch('orders/:orderId/items/:itemId/ready')
  @Roles(UserRole.KITCHEN, UserRole.MANAGER, UserRole.OWNER)
  markItemReady(
    @CurrentUser() user: any,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.kds.markItemReady(user.tenantId, restaurantId, orderId, itemId, user.userId);
  }

  // ─── M6.5 Bump entire order ready ────────────────────────────────────────

  @Patch('orders/:orderId/bump-ready')
  @Roles(UserRole.KITCHEN, UserRole.MANAGER, UserRole.OWNER)
  bumpOrderReady(
    @CurrentUser() user: any,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.kds.bumpOrderReady(user.tenantId, restaurantId, orderId, user.userId);
  }

  // ─── M6.6 Mark individual item served ────────────────────────────────────

  @Patch('orders/:orderId/items/:itemId/served')
  @Roles(UserRole.KITCHEN, UserRole.MANAGER, UserRole.OWNER, UserRole.WAITER, UserRole.CASHIER)
  markItemServed(
    @CurrentUser() user: any,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.kds.markItemServed(user.tenantId, restaurantId, orderId, itemId);
  }

  // ─── M6.7 Bump entire order served ───────────────────────────────────────

  @Patch('orders/:orderId/bump-served')
  @Roles(UserRole.KITCHEN, UserRole.MANAGER, UserRole.OWNER, UserRole.WAITER, UserRole.CASHIER)
  bumpOrderServed(
    @CurrentUser() user: any,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.kds.bumpOrderServed(user.tenantId, restaurantId, orderId);
  }
}
