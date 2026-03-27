import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnlineOrderingService } from './online-ordering.service';
import { OnlineLoyaltyService } from './loyalty/online-loyalty.service';
import { CustomerJwtAuthGuard } from './guards/customer-jwt-auth.guard';
import { CurrentCustomer } from './decorators/current-customer.decorator';
import { CreateAddressDto, UpdateAddressDto } from './dto/customer-address.dto';
import { SavePaymentMethodDto } from './dto/save-payment-method.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

/**
 * Customer-facing M15 endpoints.
 * All routes require CustomerJwtAuthGuard.
 *
 * M15.3  GET/POST /online/:slug/my/addresses
 *        PATCH/DELETE /online/:slug/my/addresses/:id
 *        PATCH /online/:slug/my/addresses/:id/default
 * M15.4  POST /online/:slug/my/reorder/:orderId
 * M15.5  GET  /online/:slug/my/loyalty
 * M15.6  GET  /online/:slug/my/orders/:orderId/receipt
 * M15.8  GET/POST /online/:slug/my/payment-methods
 *        DELETE/PATCH /online/:slug/my/payment-methods/:id
 * M15.9  GET  /online/:slug/my/notifications
 *        PATCH /online/:slug/my/notifications/:id/read
 *        PATCH /online/:slug/my/notifications/read-all
 * M15.10 DELETE /online/:slug/my/account
 */
@ApiTags('online-customer')
@ApiBearerAuth()
@Controller('online/:slug')
@UseGuards(CustomerJwtAuthGuard)
export class OnlineCustomerController {
  constructor(
    private readonly svc: OnlineOrderingService,
    private readonly loyaltySvc: OnlineLoyaltyService,
  ) {}

  // ─── M15.3 Address book ──────────────────────────────────────────────────
  @Get('my/addresses')
  @ApiOperation({ summary: 'List saved addresses' })
  listAddresses(@CurrentCustomer() customer: any) {
    return this.svc.listAddresses(customer.customerId);
  }

  @Post('my/addresses')
  @ApiOperation({ summary: 'Save a new address' })
  createAddress(@CurrentCustomer() customer: any, @Body() dto: CreateAddressDto) {
    return this.svc.createAddress(customer.tenantId, customer.customerId, dto);
  }

  @Patch('my/addresses/:addressId')
  @ApiOperation({ summary: 'Update a saved address' })
  updateAddress(
    @CurrentCustomer() customer: any,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.svc.updateAddress(customer.customerId, addressId, dto);
  }

  @Delete('my/addresses/:addressId')
  @ApiOperation({ summary: 'Delete a saved address' })
  deleteAddress(
    @CurrentCustomer() customer: any,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return this.svc.deleteAddress(customer.customerId, addressId);
  }

  @Patch('my/addresses/:addressId/default')
  @ApiOperation({ summary: 'Set address as default' })
  setDefaultAddress(
    @CurrentCustomer() customer: any,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return this.svc.setDefaultAddress(customer.customerId, addressId);
  }

  // ─── M15.4 Reorder ───────────────────────────────────────────────────────
  @Post('my/reorder/:orderId')
  @ApiOperation({ summary: 'Create a new cart from a previous order' })
  reorder(
    @Param('slug') slug: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentCustomer() customer: any,
  ) {
    return this.svc.reorder(slug, orderId, customer.customerId);
  }

  // ─── M15.5 Loyalty dashboard ─────────────────────────────────────────────
  @Get('my/loyalty')
  @ApiOperation({ summary: 'Customer loyalty dashboard — points, tier, history' })
  getLoyaltyDashboard(@CurrentCustomer() customer: any) {
    return this.loyaltySvc.getLoyaltyDashboard(customer.customerId);
  }

  // ─── M15.6 Order receipt ─────────────────────────────────────────────────
  @Get('my/orders/:orderId/receipt')
  @ApiOperation({ summary: 'Get detailed order receipt' })
  getReceipt(
    @Param('slug') slug: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentCustomer() customer: any,
  ) {
    return this.svc.getOrderReceipt(slug, orderId, customer.customerId);
  }

  // ─── M15.8 Saved payment methods ─────────────────────────────────────────
  @Get('my/payment-methods')
  @ApiOperation({ summary: 'List saved payment methods' })
  listPaymentMethods(@CurrentCustomer() customer: any) {
    return this.loyaltySvc.listSavedPaymentMethods(customer.customerId, customer.restaurantId);
  }

  @Post('my/payment-methods')
  @ApiOperation({ summary: 'Save a new payment method' })
  savePaymentMethod(@CurrentCustomer() customer: any, @Body() dto: SavePaymentMethodDto) {
    return this.loyaltySvc.savePaymentMethod(
      customer.tenantId, customer.customerId, customer.restaurantId, dto,
    );
  }

  @Delete('my/payment-methods/:methodId')
  @ApiOperation({ summary: 'Delete a saved payment method' })
  deletePaymentMethod(
    @CurrentCustomer() customer: any,
    @Param('methodId', ParseUUIDPipe) methodId: string,
  ) {
    return this.loyaltySvc.deleteSavedPaymentMethod(customer.customerId, methodId);
  }

  @Patch('my/payment-methods/:methodId/default')
  @ApiOperation({ summary: 'Set payment method as default' })
  setDefaultPaymentMethod(
    @CurrentCustomer() customer: any,
    @Param('methodId', ParseUUIDPipe) methodId: string,
  ) {
    return this.loyaltySvc.setDefaultPaymentMethod(
      customer.customerId, customer.restaurantId, methodId,
    );
  }

  // ─── M15.9 Customer notifications ────────────────────────────────────────
  @Get('my/notifications')
  @ApiOperation({ summary: 'List customer notifications (paginated)' })
  listNotifications(
    @CurrentCustomer() customer: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.loyaltySvc.listCustomerNotifications(
      customer.customerId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Patch('my/notifications/:notifId/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(
    @CurrentCustomer() customer: any,
    @Param('notifId', ParseUUIDPipe) notifId: string,
  ) {
    return this.loyaltySvc.markNotificationRead(customer.customerId, notifId);
  }

  @Patch('my/notifications/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentCustomer() customer: any) {
    return this.loyaltySvc.markAllNotificationsRead(customer.customerId);
  }

  // ─── M15.10 Account deletion ─────────────────────────────────────────────
  @Delete('my/account')
  @ApiOperation({ summary: 'Delete customer account (GDPR — requires password confirmation)' })
  deleteAccount(@CurrentCustomer() customer: any, @Body() dto: DeleteAccountDto) {
    return this.svc.deleteAccount(customer.customerId, dto);
  }
}
