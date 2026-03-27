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
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OnlineOrderingService } from './online-ordering.service';
import { OnlineCartAddItemDto } from './dto/online-cart-add-item.dto';
import { OnlineCartUpdateItemDto } from './dto/online-cart-update-item.dto';
import { PlaceOnlineOrderDto } from './dto/place-online-order.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListRestaurantsQueryDto } from './dto/list-restaurants-query.dto';
import { CustomerJwtAuthGuard } from './guards/customer-jwt-auth.guard';
import { OptionalCustomerJwtAuthGuard } from './guards/optional-customer-jwt-auth.guard';
import { CurrentCustomer } from './decorators/current-customer.decorator';

/**
 * IMPORTANT: Route registration order matters for Express.
 * Static paths registered BEFORE /:slug catch-all.
 *
 * M13.12 GET  /online/restaurants          ← FIRST (static)
 * M13.1  GET  /online/:slug                ← restaurant info
 * M13.2  GET  /online/:slug/menu
 * M13.3  GET  /online/:slug/menu/items/:id
 * M13.5a GET  /online/:slug/cart           ← init returns token
 * M13.5b POST /online/:slug/cart/items
 * M13.5c PATCH /online/:slug/cart/:cartItemId
 * M13.5d DELETE /online/:slug/cart/:cartItemId
 * M13.7  POST /online/:slug/orders
 * M13.8  GET  /online/:slug/orders/:id
 * M13.11a GET  /online/:slug/reviews
 * M13.11b POST /online/:slug/reviews
 */
@ApiTags('online-ordering')
@Controller('online')
export class OnlineOrderingController {
  constructor(private readonly svc: OnlineOrderingService) {}

  // ─── M13.12 Restaurant discovery (FIRST — static path) ────────────────
  @Get('restaurants')
  @ApiOperation({ summary: 'Discover restaurants available for online ordering' })
  listRestaurants(@Query() query: ListRestaurantsQueryDto) {
    return this.svc.listRestaurants(query);
  }

  // ─── M13.1 Restaurant info by slug ────────────────────────────────────
  @Get(':slug')
  @ApiOperation({ summary: 'Get restaurant info + online ordering settings by public slug' })
  getRestaurant(@Param('slug') slug: string) {
    return this.svc.getRestaurantBySlug(slug);
  }

  // ─── Public: enabled payment methods ─────────────────────────────────
  @Get(':slug/payment-methods')
  @ApiOperation({ summary: 'Get enabled payment methods for checkout (public)' })
  getPaymentMethods(@Param('slug') slug: string) {
    return this.svc.getPaymentMethods(slug);
  }

  // ─── M13.2 Public menu ────────────────────────────────────────────────
  @Get(':slug/menu')
  @ApiOperation({ summary: 'Browse full menu (categories + items + modifiers)' })
  getMenu(@Param('slug') slug: string) {
    return this.svc.getMenuBySlug(slug);
  }

  // ─── M13.3 Item detail ────────────────────────────────────────────────
  @Get(':slug/menu/items/:itemId')
  @ApiOperation({ summary: 'Get single item with all modifier options' })
  getItem(
    @Param('slug') slug: string,
    @Param('itemId') itemId: string,
  ) {
    return this.svc.getItemBySlug(slug, itemId);
  }

  // ─── M13.5a Cart init ─────────────────────────────────────────────────
  @Get(':slug/cart/init')
  @ApiOperation({ summary: 'Initialize a cart — returns cartToken. Pass restaurantId as query.' })
  @ApiQuery({ name: 'restaurantId', required: true })
  async initCart(
    @Param('slug') slug: string,
    @Query('restaurantId') restaurantId: string,
  ) {
    return this.svc.initOnlineCart(restaurantId);
  }

  // ─── M13.5b Add item to cart ──────────────────────────────────────────
  @Post(':slug/cart/items')
  @ApiOperation({ summary: 'Add item to online cart' })
  @ApiQuery({ name: 'restaurantId', required: true })
  addToCart(
    @Param('slug') slug: string,
    @Query('restaurantId') restaurantId: string,
    @Body() dto: OnlineCartAddItemDto,
  ) {
    return this.svc.addToOnlineCart(restaurantId, dto);
  }

  // ─── M13.5c Update cart item ──────────────────────────────────────────
  @Patch(':slug/cart/:cartItemId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiQuery({ name: 'restaurantId', required: true })
  updateCartItem(
    @Param('slug') slug: string,
    @Param('cartItemId') cartItemId: string,
    @Query('restaurantId') restaurantId: string,
    @Body() dto: OnlineCartUpdateItemDto,
  ) {
    return this.svc.updateOnlineCartItem(restaurantId, cartItemId, dto);
  }

  // ─── M13.5d Remove cart item ──────────────────────────────────────────
  @Delete(':slug/cart/:cartItemId')
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiQuery({ name: 'restaurantId', required: true })
  @ApiQuery({ name: 'cartToken', required: true })
  removeCartItem(
    @Param('slug') slug: string,
    @Param('cartItemId') cartItemId: string,
    @Query('restaurantId') restaurantId: string,
    @Query('cartToken') cartToken: string,
  ) {
    return this.svc.removeOnlineCartItem(restaurantId, cartItemId, cartToken);
  }

  // ─── M13.5e View cart ─────────────────────────────────────────────────
  @Get(':slug/cart')
  @ApiOperation({ summary: 'View cart contents' })
  @ApiQuery({ name: 'restaurantId', required: true })
  @ApiQuery({ name: 'cartToken', required: true })
  getCart(
    @Param('slug') slug: string,
    @Query('restaurantId') restaurantId: string,
    @Query('cartToken') cartToken: string,
  ) {
    return this.svc.getOnlineCart(restaurantId, cartToken);
  }

  // ─── M13.7 Place order ────────────────────────────────────────────────
  @Post(':slug/orders')
  @ApiOperation({ summary: 'Place online order (DELIVERY or TAKEAWAY)' })
  @ApiBearerAuth()
  @UseGuards(OptionalCustomerJwtAuthGuard)
  placeOrder(
    @Param('slug') slug: string,
    @Body() dto: PlaceOnlineOrderDto,
    @CurrentCustomer() customer: any,
  ) {
    return this.svc.placeOnlineOrder(slug, dto, customer?.customerId);
  }

  // ─── M13.8 Track order ────────────────────────────────────────────────
  @Get(':slug/orders/:orderId')
  @ApiOperation({ summary: 'Track order status (cartToken or customer JWT for ownership)' })
  @ApiQuery({ name: 'cartToken', required: false })
  trackOrder(
    @Param('slug') slug: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query('cartToken') cartToken?: string,
  ) {
    return this.svc.trackOnlineOrder(slug, orderId, cartToken);
  }

  // ─── M13.11a Get reviews ──────────────────────────────────────────────
  @Get(':slug/reviews')
  @ApiOperation({ summary: 'Get approved reviews for a restaurant' })
  getReviews(@Param('slug') slug: string) {
    return this.svc.getReviews(slug);
  }

  // ─── M13.11b Submit review (customer JWT required) ────────────────────
  @Post(':slug/reviews')
  @ApiOperation({ summary: 'Submit a review (requires customer JWT)' })
  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  createReview(
    @Param('slug') slug: string,
    @Body() dto: CreateReviewDto,
    @CurrentCustomer() customer: any,
  ) {
    return this.svc.createReview(
      slug,
      customer.customerId,
      customer.tenantId,
      customer.restaurantId,
      dto,
    );
  }
}
