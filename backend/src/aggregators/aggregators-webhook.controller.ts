import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AggregatorsService } from './aggregators.service';

/**
 * M17.16 — Public webhook endpoint for aggregator platforms.
 *
 * Aggregators (Foodpanda, Pathao, etc.) push new orders to:
 *   POST /api/aggregators/webhook/:platform/:restaurantId
 *
 * No auth guard — validated via HMAC X-Aggregator-Signature header.
 * This controller is registered BEFORE the protected AggregatorsController
 * to avoid any routing conflicts.
 */
@ApiTags('aggregators-webhook')
@Controller('aggregators/webhook')
export class AggregatorsWebhookController {
  private readonly logger = new Logger(AggregatorsWebhookController.name);

  constructor(private readonly svc: AggregatorsService) {}

  @Post(':platform/:restaurantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive incoming order from aggregator via webhook (M17.16)',
    description:
      'Public endpoint — no auth. Validates HMAC X-Aggregator-Signature if webhookSecret is configured on the connection.',
  })
  receiveOrder(
    @Param('platform') platform: string,
    @Param('restaurantId') restaurantId: string,
    @Headers('x-aggregator-signature') signature: string | undefined,
    @Body() payload: any,
  ) {
    return this.svc.receiveWebhookOrder(platform, restaurantId, signature, payload);
  }
}
