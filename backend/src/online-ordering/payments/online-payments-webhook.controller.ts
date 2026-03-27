import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { OnlinePaymentsService } from './online-payments.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { verifyWebhookSignature } from './webhook-signature.util';

/**
 * Webhook / callback endpoints for online payment gateways.
 * Base: /online/payments — MUST be at a static path, registered before
 * the /online/:slug parametric controller.
 *
 * These are public (no auth guard) but validate HMAC signature.
 */
@ApiTags('online-payments-webhook')
@Controller('online/payments')
export class OnlinePaymentsWebhookController {
  private readonly logger = new Logger(OnlinePaymentsWebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly svc: OnlinePaymentsService,
    config: ConfigService,
  ) {
    this.webhookSecret = config.get<string>('WEBHOOK_SECRET') ?? 'restrocloud_webhook_mock_secret';
  }

  // ─── M14.2 Public payment confirmation (open callback) ──────────────────
  @Post('confirm')
  @ApiOperation({
    summary: 'Confirm/fail an online payment (gateway callback simulation)',
    description: 'Public endpoint. Idempotent — safe to call multiple times.',
  })
  confirm(@Body() dto: ConfirmPaymentDto) {
    return this.svc.confirmPayment(dto);
  }

  // ─── M14.9 Signed webhook per gateway ────────────────────────────────────
  @Post('webhook/:gateway')
  @ApiOperation({
    summary: 'Signed webhook endpoint (validates X-Gateway-Signature header)',
  })
  webhook(
    @Param('gateway') gateway: string,
    @Headers('x-gateway-signature') signature: string,
    @Body() body: ConfirmPaymentDto,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing X-Gateway-Signature header');
    }

    const rawPayload = JSON.stringify(body);
    const valid = verifyWebhookSignature(rawPayload, signature, this.webhookSecret);
    if (!valid) {
      this.logger.warn(`Invalid webhook signature for gateway: ${gateway}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    return this.svc.confirmPayment(body);
  }
}
