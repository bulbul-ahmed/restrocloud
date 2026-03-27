import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdersService } from './orders.service';

/**
 * M16.3 — Auto-accept cron job.
 * Runs every minute and auto-accepts PENDING orders that have been
 * waiting longer than the restaurant's configured autoAcceptMinutes threshold.
 *
 * Configure per restaurant:
 *   PATCH /restaurants/:id/settings/auto-accept-timer
 *   Body: { pos: 0, qr: 3, online: 5 }  (0 = disabled)
 *
 * Also requires autoAccept to be enabled for that channel:
 *   PATCH /restaurants/:id/auto-accept
 *   Body: { qr: true, online: true }
 */
@Injectable()
export class OrdersCronService {
  private readonly logger = new Logger(OrdersCronService.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoAccept() {
    try {
      await this.ordersService.autoAcceptPendingOrders();
    } catch (err) {
      this.logger.error(`Auto-accept cron error: ${err.message}`);
    }
  }
}
