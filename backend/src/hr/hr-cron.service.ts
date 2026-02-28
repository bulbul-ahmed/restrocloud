import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service';
import { HrService } from './hr.service';

@Injectable()
export class HrCronService {
  private readonly logger = new Logger(HrCronService.name);

  constructor(
    private prisma: PrismaService,
    private hrService: HrService,
  ) {}

  // Every 15 minutes: fire late-arrival notifications for shifts that started
  // 15+ minutes ago without a corresponding clock-in
  @Cron('*/15 * * * *')
  async detectLateArrivals() {
    try {
      const now = new Date();
      const fifteenMinAgo = new Date(now.getTime() - 15 * 60_000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60_000);

      // Shifts that started between 15 min ago and 1 hour ago (still current window)
      const overdueShifts = await this.prisma.shift.findMany({
        where: {
          status: 'SCHEDULED',
          startsAt: { gte: oneHourAgo, lte: fifteenMinAgo },
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, restaurantId: true, tenantId: true } },
        },
      });

      for (const shift of overdueShifts) {
        const hasClockedIn = await this.prisma.timeEntry.findFirst({
          where: {
            userId: shift.userId,
            tenantId: shift.tenantId,
            clockIn: { gte: shift.startsAt },
          },
        });
        if (!hasClockedIn) {
          this.logger.warn(
            `Late arrival: ${shift.user.firstName} ${shift.user.lastName} has not clocked in for shift ${shift.id}`,
          );
          // Note: Notification firing can be wired here if NotificationsService is injected
        }
      }
    } catch (e) {
      this.logger.error('detectLateArrivals error', e);
    }
  }

  // Nightly at midnight: mark yesterday's SCHEDULED shifts as MISSED if no clock-in found
  @Cron('0 0 * * *')
  async markMissedShifts() {
    try {
      const restaurants = await this.prisma.restaurant.findMany({
        where: { isActive: true },
        select: { id: true, tenantId: true },
      });

      for (const r of restaurants) {
        await this.hrService.detectAndMarkMissedShifts(r.tenantId, r.id).catch(e => {
          this.logger.error(`markMissedShifts failed for restaurant ${r.id}`, e);
        });
      }

      this.logger.log(`markMissedShifts complete for ${restaurants.length} restaurants`);
    } catch (e) {
      this.logger.error('markMissedShifts error', e);
    }
  }
}
