import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { CrmService } from './crm.service';

@Injectable()
export class CrmCronService {
  private readonly logger = new Logger(CrmCronService.name);

  constructor(
    private prisma: PrismaService,
    private crm: CrmService,
  ) {}

  // M21.8 — Birthday messages at 08:00 daily
  @Cron('0 8 * * *')
  async sendBirthdayMessages() {
    this.logger.log('CRM Birthday cron: starting');
    const restaurants = await this.prisma.restaurant.findMany({
      where: { isActive: true },
    });
    for (const r of restaurants) {
      await this.crm
        .sendBirthdayMessages(r.tenantId, r.id)
        .catch((err) =>
          this.logger.warn(`Birthday cron failed for ${r.id}: ${err.message}`),
        );
    }
    this.logger.log(`CRM Birthday cron: processed ${restaurants.length} restaurants`);
  }

  // M21.9 — Re-engagement every Monday at 09:00
  @Cron('0 9 * * 1')
  async sendReengagementMessages() {
    this.logger.log('CRM Re-engagement cron: starting');
    const restaurants = await this.prisma.restaurant.findMany({
      where: { isActive: true },
    });
    for (const r of restaurants) {
      await this.crm
        .sendReengagementMessages(r.tenantId, r.id)
        .catch((err) =>
          this.logger.warn(`Re-engagement cron failed for ${r.id}: ${err.message}`),
        );
    }
    this.logger.log(`CRM Re-engagement cron: processed ${restaurants.length} restaurants`);
  }
}
