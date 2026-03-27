import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { QrOrderingService } from './qr-ordering.service';
import { CartAddItemDto } from './dto/cart-add-item.dto';
import { CartUpdateItemDto } from './dto/cart-update-item.dto';
import { PlaceQrOrderDto } from './dto/place-qr-order.dto';
import { RequestBillDto } from './dto/request-bill.dto';
import { IdentifyGuestDto } from './dto/identify-guest.dto';
import { CallWaiterDto } from './dto/call-waiter.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { InitCartDto } from './dto/init-cart.dto';

/**
 * IMPORTANT: All static-segment routes (menu, cart, identify, place-order,
 * orders/*) MUST be registered BEFORE the greedy /:restaurantId/:tableId
 * catch-all route. Express matches routes in registration order.
 */
@ApiTags('qr-ordering')
@Controller('qr')
// No guards — fully public
export class QrOrderingController {
  constructor(private readonly svc: QrOrderingService) {}

  // ─── M12.2 Public menu (static "menu" segment — register before /:tableId) ─

  @Get(':restaurantId/menu')
  @ApiOperation({ summary: 'Get full public menu (categories + items + modifiers)' })
  getPublicMenu(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
  ) {
    return this.svc.getPublicMenu(restaurantId);
  }

  // ─── M12.3 Item detail (3-segment — register before 2-segment catch-all) ──

  @Get(':restaurantId/menu/items/:itemId')
  @ApiOperation({ summary: 'Get single menu item with all modifier options' })
  getPublicItem(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.svc.getPublicItem(restaurantId, itemId);
  }

  // ─── All active carts at a table ─────────────────────────────────────────

  @Get(':restaurantId/:tableId/carts')
  @ApiOperation({ summary: 'Get all active (un-ordered) carts at a table' })
  getTableCarts(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ) {
    return this.svc.getTableCarts(restaurantId, tableId);
  }

  // ─── M12.4 Init cart (POST so no conflict with GET /:tableId) ─────────────

  @Post(':restaurantId/:tableId/cart/init')
  @ApiOperation({ summary: 'Initialize a guest cart — returns guestToken' })
  initCart(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body() dto: InitCartDto,
  ) {
    return this.svc.initCart(restaurantId, tableId, dto.deviceId);
  }

  // ─── M12.5a Add item to cart ──────────────────────────────────────────────

  @Post(':restaurantId/cart')
  @ApiOperation({ summary: 'Add item to cart' })
  addToCart(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() dto: CartAddItemDto,
  ) {
    return this.svc.addToCart(restaurantId, dto);
  }

  // ─── M12.5b Update cart item ──────────────────────────────────────────────

  @Patch(':restaurantId/cart/:cartItemId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  updateCartItem(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('cartItemId', ParseUUIDPipe) cartItemId: string,
    @Body() dto: CartUpdateItemDto,
  ) {
    return this.svc.updateCartItem(restaurantId, cartItemId, dto);
  }

  // ─── M12.5c Remove cart item ──────────────────────────────────────────────

  @Delete(':restaurantId/cart/:cartItemId')
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiQuery({ name: 'guestToken', required: true })
  removeCartItem(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('cartItemId', ParseUUIDPipe) cartItemId: string,
    @Query('guestToken') guestToken: string,
  ) {
    return this.svc.removeCartItem(restaurantId, cartItemId, guestToken);
  }

  // ─── M12.6 View cart (static "cart" segment) ──────────────────────────────

  @Get(':restaurantId/cart')
  @ApiOperation({ summary: 'View current cart with price estimates' })
  @ApiQuery({ name: 'guestToken', required: true })
  getCart(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query('guestToken') guestToken: string,
  ) {
    return this.svc.getCart(restaurantId, guestToken);
  }

  // ─── M12.7 Place order (static "place-order" segment) ────────────────────

  @Post(':restaurantId/place-order')
  @ApiOperation({ summary: 'Place order from cart — creates Order + items in DB' })
  placeOrder(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() dto: PlaceQrOrderDto,
    @Req() req: any,
  ) {
    return this.svc.placeOrder(restaurantId, dto, req);
  }

  // ─── My order lookup (non-initiating guests discover merged order) ──────────

  @Get(':restaurantId/my-order')
  @ApiOperation({ summary: 'Resolve orderId for a guest token — used when cart was merged by another guest' })
  @ApiQuery({ name: 'guestToken', required: true })
  getMyOrder(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query('guestToken') guestToken: string,
  ) {
    return this.svc.getMyOrder(restaurantId, guestToken);
  }

  // ─── M12.8 Track order (3-segment path) ───────────────────────────────────

  @Get(':restaurantId/orders/:orderId/status')
  @ApiOperation({ summary: 'Track order status and item kitchen statuses' })
  @ApiQuery({ name: 'guestToken', required: true })
  trackOrder(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query('guestToken') guestToken: string,
  ) {
    return this.svc.trackOrder(restaurantId, orderId, guestToken);
  }

  // ─── M12.9 Request bill (3-segment path) ──────────────────────────────────

  @Post(':restaurantId/orders/:orderId/request-bill')
  @ApiOperation({ summary: 'Request the bill — notifies waiter/cashier' })
  requestBill(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: RequestBillDto,
  ) {
    return this.svc.requestBill(restaurantId, orderId, dto);
  }

  // ─── M12.10 Get receipt (3-segment path) ──────────────────────────────────

  @Get(':restaurantId/orders/:orderId/receipt')
  @ApiOperation({ summary: 'Get formatted receipt for an order' })
  @ApiQuery({ name: 'guestToken', required: true })
  getReceipt(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query('guestToken') guestToken: string,
  ) {
    return this.svc.getReceipt(restaurantId, orderId, guestToken);
  }

  // ─── M12.7 Upsell suggestions (4-segment — register before 2-segment) ─────

  @Get(':restaurantId/menu/items/:itemId/suggestions')
  @ApiOperation({ summary: 'M12.7 — Get upsell/cross-sell suggestions for an item' })
  getUpsells(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.svc.getUpsells(restaurantId, itemId);
  }

  // ─── M12.12a Staff online check ───────────────────────────────────────────

  @Get(':restaurantId/staff-online')
  @ApiOperation({ summary: 'M12.12a — Check if any waiter/manager is currently online' })
  isStaffOnline(@Param('restaurantId', ParseUUIDPipe) restaurantId: string) {
    return this.svc.isStaffOnline(restaurantId);
  }

  // ─── M12.12 Call waiter (static "call-waiter" segment) ───────────────────

  @Post(':restaurantId/call-waiter')
  @ApiOperation({ summary: 'M12.12 — Customer taps "Call Waiter" button' })
  callWaiter(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() dto: CallWaiterDto,
  ) {
    return this.svc.callWaiter(restaurantId, dto);
  }

  // ─── M12.14 Submit post-meal feedback ─────────────────────────────────────

  @Post(':restaurantId/orders/:orderId/feedback')
  @ApiOperation({ summary: 'M12.14 — Submit post-meal star rating and comment' })
  submitFeedback(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.svc.submitFeedback(restaurantId, orderId, dto);
  }

  // ─── M12.11 Identify guest (static "identify" segment) ───────────────────

  @Post(':restaurantId/identify')
  @ApiOperation({ summary: 'Optional: guest provides name/phone to attach to order' })
  identifyGuest(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Body() dto: IdentifyGuestDto,
  ) {
    return this.svc.identifyGuest(restaurantId, dto);
  }

  // ─── Session summary (all rounds) — register before 2-param catch-all ────

  @Get(':restaurantId/session/summary')
  @ApiOperation({ summary: 'Get all order rounds in the current table session' })
  @ApiQuery({ name: 'guestToken', required: true })
  getSessionSummary(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query('guestToken') guestToken: string,
  ) {
    return this.svc.getSessionSummary(restaurantId, guestToken);
  }

  // ─── M12.1 Resolve table (LAST — greedy 2-param catch-all) ───────────────

  @Get(':restaurantId/:tableId')
  @ApiOperation({ summary: 'Resolve QR code — get restaurant + table context' })
  resolveTable(
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ) {
    return this.svc.resolveTable(restaurantId, tableId);
  }
}
