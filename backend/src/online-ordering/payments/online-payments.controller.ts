import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { OnlinePaymentsService } from './online-payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { CustomerRefundRequestDto } from './dto/customer-refund.dto';
import { OptionalCustomerJwtAuthGuard } from '../guards/optional-customer-jwt-auth.guard';
import { CustomerJwtAuthGuard } from '../guards/customer-jwt-auth.guard';
import { CurrentCustomer } from '../decorators/current-customer.decorator';

/**
 * Slug-scoped online payment routes.
 * Base: /online/:slug
 *
 * Static webhook endpoints live in OnlinePaymentsWebhookController
 * (@Controller('online/payments')) registered FIRST in the module to avoid
 * conflict with the /:slug catch-all here.
 */
@ApiTags('online-payments')
@Controller('online/:slug')
export class OnlinePaymentsController {
  constructor(private readonly svc: OnlinePaymentsService) {}

  // ─── M14.1 Initiate payment ─────────────────────────────────────────────
  @Post('orders/:orderId/pay')
  @ApiOperation({ summary: 'Initiate payment for an online order (STRIPE/SSLCOMMERZ/BKASH/COD)' })
  @ApiBearerAuth()
  @UseGuards(OptionalCustomerJwtAuthGuard)
  initiatePayment(
    @Param('slug') slug: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: InitiatePaymentDto,
    @CurrentCustomer() customer: any,
  ) {
    return this.svc.initiatePayment(slug, orderId, dto, customer?.customerId);
  }

  // ─── M14.3 Get payment status ──────────────────────────────────────────
  @Get('orders/:orderId/payment')
  @ApiOperation({ summary: 'Poll payment status for an online order' })
  @ApiQuery({ name: 'cartToken', required: false })
  @ApiBearerAuth()
  @UseGuards(OptionalCustomerJwtAuthGuard)
  getPaymentStatus(
    @Param('slug') slug: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query('cartToken') cartToken: string | undefined,
    @CurrentCustomer() customer: any,
  ) {
    return this.svc.getPaymentStatus(slug, orderId, cartToken, customer?.customerId);
  }

  // ─── Stripe Checkout confirm (called after Stripe redirects back) ──────
  @Post('orders/:orderId/payment/stripe-confirm')
  @ApiOperation({ summary: 'Confirm a Stripe Checkout Session after redirect (no auth required for guest)' })
  @UseGuards(OptionalCustomerJwtAuthGuard)
  confirmStripePayment(
    @Param('slug') slug: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: { sessionId: string; cartToken?: string },
    @CurrentCustomer() customer: any,
  ) {
    return this.svc.confirmStripeCheckout(
      slug, orderId, body.sessionId, body.cartToken, customer?.customerId,
    );
  }

  // ─── M14.5 Customer refund request ────────────────────────────────────
  @Post('orders/:orderId/refund')
  @ApiOperation({ summary: 'Request refund for a completed online order (customer JWT required)' })
  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  requestRefund(
    @Param('slug') slug: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CustomerRefundRequestDto,
    @CurrentCustomer() customer: any,
  ) {
    return this.svc.requestRefund(slug, orderId, dto, customer.customerId);
  }

  // ─── M14.7 Customer payment history ───────────────────────────────────
  @Get('my/payments')
  @ApiOperation({ summary: 'Get customer payment history (customer JWT required)' })
  @ApiBearerAuth()
  @UseGuards(CustomerJwtAuthGuard)
  getPaymentHistory(
    @Param('slug') slug: string,
    @CurrentCustomer() customer: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.getCustomerPaymentHistory(
      customer.customerId,
      customer.restaurantId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }
}
