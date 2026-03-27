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
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { UpdateKitchenStatusDto } from './dto/update-kitchen-status.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { AssignTableDto } from './dto/assign-table.dto';
import { RejectOrderDto } from './dto/reject-order.dto';

@ApiTags('orders')
@Controller('restaurants/:restaurantId/orders')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth('access-token')
@ApiParam({ name: 'restaurantId', description: 'Restaurant UUID' })
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  // ─── M4.1 Create order ───────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.CASHIER)
  @ApiOperation({ summary: 'Create a new order (CASHIER+ role)' })
  @ApiResponse({ status: 201, description: 'Order created' })
  createOrder(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(tenantId, restaurantId, user.id, dto);
  }

  // ─── M4.2 List orders ────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List orders with filters (status, channel, date range, pagination)',
  })
  listOrders(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.ordersService.listOrders(tenantId, restaurantId, query);
  }

  // ─── M4.3 Get order detail ───────────────────────────────────────────────

  @Get(':orderId')
  @ApiOperation({ summary: 'Get full order detail with items, modifiers, status history' })
  getOrder(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.getOrder(tenantId, restaurantId, orderId);
  }

  // ─── M4.4 Update order status ────────────────────────────────────────────

  @Patch(':orderId/status')
  @Roles(UserRole.MANAGER)
  @ApiOperation({
    summary:
      'Update order status (MANAGER+). State machine: PENDING→ACCEPTED→PREPARING→READY→SERVED→COMPLETED',
  })
  updateOrderStatus(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(
      tenantId,
      restaurantId,
      orderId,
      user.id,
      user.role as UserRole,
      dto,
    );
  }

  // ─── M4.5 Cancel order ───────────────────────────────────────────────────

  @Patch(':orderId/cancel')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Cancel an order (MANAGER+). Not allowed if COMPLETED/CANCELLED/REFUNDED.' })
  cancelOrder(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(
      tenantId,
      restaurantId,
      orderId,
      user.id,
      user.role as UserRole,
      dto,
    );
  }

  // ─── M4.6 Update item kitchen status (KDS) ───────────────────────────────

  @Patch(':orderId/items/:itemId/kitchen-status')
  @Roles(UserRole.KITCHEN)
  @ApiOperation({ summary: 'Update kitchen status for a single order item (KITCHEN+ role)' })
  updateKitchenStatus(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateKitchenStatusDto,
  ) {
    return this.ordersService.updateKitchenStatus(
      tenantId,
      restaurantId,
      orderId,
      itemId,
      user.id,
      user.role as UserRole,
      dto,
    );
  }

  // ─── M4.7 Void order item ────────────────────────────────────────────────

  @Patch(':orderId/items/:itemId/void')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Void (remove) a single order item (MANAGER+). Recalculates totals.' })
  voidOrderItem(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.voidOrderItem(
      tenantId,
      restaurantId,
      orderId,
      itemId,
      user.role as UserRole,
    );
  }

  // ─── M4.8 Add items to existing order ────────────────────────────────────

  @Post(':orderId/items')
  @Roles(UserRole.CASHIER)
  @ApiOperation({
    summary: 'Add items to an existing PENDING/ACCEPTED/PREPARING order (CASHIER+)',
  })
  addOrderItems(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
    @Body() dto: AddOrderItemsDto,
  ) {
    return this.ordersService.addOrderItems(
      tenantId,
      restaurantId,
      orderId,
      user.id,
      user.role as UserRole,
      dto,
    );
  }

  // ─── M5.8 Apply discount ─────────────────────────────────────────────────

  @Patch(':orderId/discount')
  @Roles(UserRole.MANAGER)
  @ApiOperation({
    summary: 'Apply or update a discount on an order (MANAGER+). Supports FLAT or PERCENT.',
  })
  applyDiscount(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
    @Body() dto: ApplyDiscountDto,
  ) {
    return this.ordersService.applyDiscount(
      tenantId,
      restaurantId,
      orderId,
      user.role as UserRole,
      dto,
    );
  }

  // ─── M5.9 Assign order to table/session ──────────────────────────────────

  @Patch(':orderId/table')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Assign or reassign an order to a table/session (MANAGER+)' })
  assignTable(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
    @Body() dto: AssignTableDto,
  ) {
    return this.ordersService.assignTable(
      tenantId,
      restaurantId,
      orderId,
      user.role as UserRole,
      dto,
    );
  }

  // ─── M16.2 Accept order ───────────────────────────────────────────────────

  @Patch(':orderId/accept')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Accept a pending order — PENDING → ACCEPTED (MANAGER+)' })
  acceptOrder(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.acceptOrder(
      tenantId, restaurantId, orderId, user.id, user.role as UserRole,
    );
  }

  // ─── M16.2 Reject order ───────────────────────────────────────────────────

  @Patch(':orderId/reject')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Reject a pending order — PENDING → CANCELLED (MANAGER+)' })
  rejectOrder(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
    @Body() dto: RejectOrderDto,
  ) {
    return this.ordersService.rejectOrder(
      tenantId, restaurantId, orderId, user.id, user.role as UserRole, dto,
    );
  }

  // ─── M16.7 Print ticket ───────────────────────────────────────────────────

  @Get(':orderId/print-ticket')
  @Roles(UserRole.CASHIER)
  @ApiOperation({ summary: 'Get formatted print ticket data for an order (CASHIER+)' })
  getPrintTicket(
    @CurrentTenant() tenantId: string,
    @Param('restaurantId') restaurantId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.getPrintTicket(tenantId, restaurantId, orderId);
  }
}
