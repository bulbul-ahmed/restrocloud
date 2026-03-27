import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../common/email/email.service';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class AnalyticsCronService {
  private readonly logger = new Logger(AnalyticsCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Cron('0 23 * * *')
  async sendDailyReports() {
    this.logger.log('Running nightly analytics email cron...');

    const restaurants = await this.prisma.restaurant.findMany({
      where: { isActive: true },
      include: {
        users: {
          where: { role: UserRole.OWNER, isActive: true },
          select: { id: true, email: true, firstName: true },
        },
      },
    });

    for (const restaurant of restaurants) {
      if (restaurant.users.length === 0) continue;

      try {
        const [dashboard, topItems] = await Promise.all([
          this.analyticsService.getDashboard(restaurant.tenantId, restaurant.id),
          this.analyticsService.getTopItems(restaurant.tenantId, restaurant.id, { limit: 3 }),
        ]);

        const today = new Date().toISOString().split('T')[0];
        const kpis = dashboard.today;

        for (const owner of restaurant.users) {
          try {
            await this.emailService.sendMail({
              to: owner.email,
              subject: `Daily Report — ${restaurant.name} — ${today}`,
              html: this.buildEmailHtml(restaurant.name, today, kpis, topItems as any[]),
            });
          } catch (err) {
            this.logger.error(
              `Failed to send report email to ${owner.email} for restaurant ${restaurant.id}: ${err.message}`,
            );
          }
        }
      } catch (err) {
        this.logger.error(
          `Failed to generate analytics for restaurant ${restaurant.id}: ${err.message}`,
        );
      }
    }

    this.logger.log('Nightly analytics email cron complete.');
  }

  private buildEmailHtml(
    restaurantName: string,
    date: string,
    kpis: {
      revenue: number;
      orders: number;
      completedOrders: number;
      avgOrderValue: number;
      newCustomers: number;
      pendingOrders: number;
    },
    topItems: { rank: number; name: string; totalQty: number; totalRevenue: number }[],
  ): string {
    const topItemsRows = topItems
      .map(
        (item) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;">${item.rank}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;">${item.name}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${item.totalQty}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">৳${item.totalRevenue.toFixed(2)}</td>
      </tr>`,
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;margin:0;padding:20px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#ff6b35;padding:20px 24px;">
      <h2 style="color:#fff;margin:0;font-size:18px;">Daily Report — ${restaurantName}</h2>
      <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">${date}</p>
    </div>
    <div style="padding:24px;">
      <h3 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;color:#888;letter-spacing:.5px;">Today's KPIs</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr style="background:#fff8f5;">
          <td style="padding:10px 12px;font-weight:600;color:#ff6b35;font-size:22px;">৳${kpis.revenue.toFixed(2)}</td>
          <td style="padding:10px 12px;color:#555;font-size:13px;">Total Revenue</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;font-size:20px;">${kpis.orders}</td>
          <td style="padding:10px 12px;color:#555;font-size:13px;">Total Orders</td>
        </tr>
        <tr style="background:#fff8f5;">
          <td style="padding:10px 12px;font-weight:600;font-size:20px;">${kpis.completedOrders}</td>
          <td style="padding:10px 12px;color:#555;font-size:13px;">Completed Orders</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;font-size:20px;">৳${kpis.avgOrderValue.toFixed(2)}</td>
          <td style="padding:10px 12px;color:#555;font-size:13px;">Avg Order Value</td>
        </tr>
        <tr style="background:#fff8f5;">
          <td style="padding:10px 12px;font-weight:600;font-size:20px;">${kpis.newCustomers}</td>
          <td style="padding:10px 12px;color:#555;font-size:13px;">New Customers</td>
        </tr>
      </table>

      ${topItems.length > 0 ? `
      <h3 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;color:#888;letter-spacing:.5px;">Top 3 Items</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#888;">#</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#888;">Item</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#888;">Revenue</th>
          </tr>
        </thead>
        <tbody>
          ${topItemsRows}
        </tbody>
      </table>
      ` : ''}
    </div>
    <div style="padding:16px 24px;background:#f9f9f9;border-top:1px solid #eee;">
      <p style="margin:0;font-size:12px;color:#aaa;">Powered by RestroCloud · This is an automated daily report.</p>
    </div>
  </div>
</body>
</html>`;
  }
}
