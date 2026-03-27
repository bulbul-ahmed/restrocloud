import { Injectable } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { ExportQueryDto } from './dto/export-query.dto';

@Injectable()
export class AnalyticsExportService {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async generateCsvReport(
    tenantId: string,
    restaurantId: string,
    dto: ExportQueryDto,
  ): Promise<string> {
    const query = { dateFrom: dto.dateFrom, dateTo: dto.dateTo };

    const [revenue, channels, methods, topItems] = await Promise.all([
      this.analyticsService.getRevenueByDay(tenantId, restaurantId, query),
      this.analyticsService.getOrdersByChannel(tenantId, restaurantId, query),
      this.analyticsService.getPaymentsByMethod(tenantId, restaurantId, query),
      this.analyticsService.getTopItems(tenantId, restaurantId, { ...query, limit: 20 }),
    ]);

    const lines: string[] = [];

    // Section 1: Revenue Summary
    lines.push('Revenue Summary');
    lines.push('Metric,Value');
    lines.push(`Total Revenue,${revenue.totalRevenue}`);
    lines.push(`Total Orders,${revenue.totalOrders}`);
    lines.push(`Avg Daily Revenue,${revenue.avgDailyRevenue}`);
    lines.push('');

    // Section 2: Daily Breakdown
    lines.push('Daily Breakdown');
    lines.push('Date,Revenue,Orders');
    for (const row of revenue.daily) {
      lines.push(`${String(row.date).split('T')[0]},${row.revenue},${row.orders}`);
    }
    lines.push('');

    // Section 3: Sales by Channel
    lines.push('Sales by Channel');
    lines.push('Channel,Orders,Revenue');
    for (const row of channels as { channel: string; orders: number; revenue: number }[]) {
      lines.push(`${row.channel},${row.orders},${row.revenue}`);
    }
    lines.push('');

    // Section 4: Sales by Payment Method
    lines.push('Sales by Payment Method');
    lines.push('Method,Transactions,Revenue');
    for (const row of methods as { method: string; transactions: number; revenue: number }[]) {
      lines.push(`${row.method},${row.transactions},${row.revenue}`);
    }
    lines.push('');

    // Section 5: Top Items
    lines.push('Top Items');
    lines.push('Rank,Name,Qty Sold,Revenue');
    for (const item of topItems as { rank: number; name: string; totalQty: number; totalRevenue: number }[]) {
      const safeName = item.name.includes(',') ? `"${item.name}"` : item.name;
      lines.push(`${item.rank},${safeName},${item.totalQty},${item.totalRevenue}`);
    }

    return lines.join('\r\n');
  }
}
