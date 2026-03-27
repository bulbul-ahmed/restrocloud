import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

// NOTE: $queryRaw uses actual DB column names. This schema has NO @map() on fields,
// so column names match the Prisma field names exactly (camelCase).

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private parseDateRange(query: AnalyticsQueryDto): { from: Date; to: Date } {
    const to = query.dateTo ? new Date(query.dateTo) : new Date();
    to.setHours(23, 59, 59, 999);
    const from = query.dateFrom ? new Date(query.dateFrom) : new Date(Date.now() - 30 * 86400000);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  private cacheKey(restaurantId: string, endpoint: string, query: AnalyticsQueryDto): string {
    return `analytics:${restaurantId}:${endpoint}:${query.dateFrom ?? ''}:${query.dateTo ?? ''}:${query.limit ?? ''}`;
  }

  private async cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
    const hit = await this.redis.getJson<T>(key);
    if (hit !== null) return hit;
    const result = await fn();
    await this.redis.setJson(key, result, ttl);
    return result;
  }

  // ─── M9.1 Dashboard KPIs ─────────────────────────────────────────────────────

  async getDashboard(tenantId: string, restaurantId: string) {
    const key = `analytics:${restaurantId}:dashboard`;

    return this.cached(key, 60, async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const orderWhere = { tenantId, restaurantId, createdAt: { gte: todayStart, lte: todayEnd } };
      const completedWhere = { ...orderWhere, status: { notIn: ['CANCELLED', 'REFUNDED'] as any } };

      const [
        revenueAgg,
        orderCount,
        newCustomers,
        activeSessionCount,
        pendingOrders,
        yesterdayRevAgg,
      ] = await Promise.all([
        this.prisma.order.aggregate({ where: completedWhere, _sum: { totalAmount: true }, _count: true }),
        this.prisma.order.count({ where: orderWhere }),
        this.prisma.customer.count({ where: { tenantId, restaurantId, createdAt: { gte: todayStart } } }),
        this.prisma.tableSession.count({ where: { tenantId, status: { in: ['OPEN', 'BILL_REQUESTED'] as any } } }),
        this.prisma.order.count({ where: { tenantId, restaurantId, status: 'PENDING' as any } }),
        this.prisma.order.aggregate({
          where: {
            ...completedWhere,
            createdAt: {
              gte: new Date(todayStart.getTime() - 86400000),
              lte: new Date(todayEnd.getTime() - 86400000),
            },
          },
          _sum: { totalAmount: true },
        }),
      ]);

      const todayRevenue = Number(revenueAgg._sum.totalAmount ?? 0);
      const completedCount = revenueAgg._count;
      const avgOrderValue = completedCount > 0 ? todayRevenue / completedCount : 0;
      const yesterdayRevenue = Number(yesterdayRevAgg._sum.totalAmount ?? 0);
      const revenueChange = yesterdayRevenue > 0
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
        : null;

      return {
        today: {
          revenue: +todayRevenue.toFixed(2),
          orders: orderCount,
          completedOrders: completedCount,
          avgOrderValue: +avgOrderValue.toFixed(2),
          newCustomers,
          activeTableSessions: activeSessionCount,
          pendingOrders,
        },
        vsYesterday: {
          yesterdayRevenue: +yesterdayRevenue.toFixed(2),
          revenueChange: revenueChange !== null ? +revenueChange.toFixed(1) : null,
        },
      };
    });
  }

  // ─── M9.2 Revenue by day ──────────────────────────────────────────────────────

  async getRevenueByDay(tenantId: string, restaurantId: string, query: AnalyticsQueryDto) {
    const { from, to } = this.parseDateRange(query);
    const key = this.cacheKey(restaurantId, 'revenue-day', query);

    return this.cached(key, 300, async () => {
      type Row = { date: Date; revenue: number; orders: bigint };

      const rows = await this.prisma.$queryRaw<Row[]>`
        SELECT
          DATE_TRUNC('day', "createdAt")::date    AS date,
          COALESCE(SUM("totalAmount"), 0)::float   AS revenue,
          COUNT(*)::bigint                          AS orders
        FROM orders
        WHERE "tenantId"     = ${tenantId}
          AND "restaurantId" = ${restaurantId}
          AND "createdAt"   >= ${from}
          AND "createdAt"   <= ${to}
          AND status NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date
      `;

      const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
      const totalOrders  = rows.reduce((s, r) => s + Number(r.orders), 0);

      return {
        dateFrom: from,
        dateTo: to,
        totalRevenue: +totalRevenue.toFixed(2),
        totalOrders,
        avgDailyRevenue: rows.length > 0 ? +(totalRevenue / rows.length).toFixed(2) : 0,
        daily: rows.map((r) => ({
          date: r.date,
          revenue: +r.revenue.toFixed(2),
          orders: Number(r.orders),
        })),
      };
    });
  }

  // ─── M9.3 Orders by channel ───────────────────────────────────────────────────

  async getOrdersByChannel(tenantId: string, restaurantId: string, query: AnalyticsQueryDto) {
    const { from, to } = this.parseDateRange(query);
    const key = this.cacheKey(restaurantId, 'orders-channel', query);

    return this.cached(key, 300, async () => {
      const rows = await this.prisma.order.groupBy({
        by: ['channel'],
        where: { tenantId, restaurantId, createdAt: { gte: from, lte: to } },
        _count: { id: true },
        _sum: { totalAmount: true },
        orderBy: { _count: { id: 'desc' } },
      });

      return rows.map((r) => ({
        channel: r.channel,
        orders: r._count.id,
        revenue: +Number(r._sum.totalAmount ?? 0).toFixed(2),
      }));
    });
  }

  // ─── M9.4 Top selling items ───────────────────────────────────────────────────

  async getTopItems(tenantId: string, restaurantId: string, query: AnalyticsQueryDto) {
    const { from, to } = this.parseDateRange(query);
    const limit = query.limit ?? 10;
    const key = this.cacheKey(restaurantId, 'top-items', query);

    return this.cached(key, 300, async () => {
      type Row = { item_id: string; name: string; total_qty: bigint; total_revenue: number };

      const rows = await this.prisma.$queryRaw<Row[]>`
        SELECT
          oi."itemId"                         AS item_id,
          oi.name,
          SUM(oi.quantity)::bigint             AS total_qty,
          COALESCE(SUM(oi."totalPrice"), 0)::float AS total_revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi."orderId"
        WHERE o."tenantId"     = ${tenantId}
          AND o."restaurantId" = ${restaurantId}
          AND o."createdAt"   >= ${from}
          AND o."createdAt"   <= ${to}
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
          AND oi."isVoid" = false
        GROUP BY oi."itemId", oi.name
        ORDER BY total_qty DESC
        LIMIT ${limit}
      `;

      return rows.map((r, i) => ({
        rank: i + 1,
        itemId: r.item_id,
        name: r.name,
        totalQty: Number(r.total_qty),
        totalRevenue: +r.total_revenue.toFixed(2),
      }));
    });
  }

  // ─── M9.5 Orders by status ────────────────────────────────────────────────────

  async getOrdersByStatus(tenantId: string, restaurantId: string, query: AnalyticsQueryDto) {
    const { from, to } = this.parseDateRange(query);
    const key = this.cacheKey(restaurantId, 'orders-status', query);

    return this.cached(key, 300, async () => {
      const rows = await this.prisma.order.groupBy({
        by: ['status'],
        where: { tenantId, restaurantId, createdAt: { gte: from, lte: to } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });

      const total = rows.reduce((s, r) => s + r._count.id, 0);

      return rows.map((r) => ({
        status: r.status,
        count: r._count.id,
        percentage: total > 0 ? +((r._count.id / total) * 100).toFixed(1) : 0,
      }));
    });
  }

  // ─── M9.6 Payments by method ──────────────────────────────────────────────────

  async getPaymentsByMethod(tenantId: string, restaurantId: string, query: AnalyticsQueryDto) {
    const { from, to } = this.parseDateRange(query);
    const key = this.cacheKey(restaurantId, 'payments-method', query);

    return this.cached(key, 300, async () => {
      const rows = await this.prisma.payment.groupBy({
        by: ['method'],
        where: {
          tenantId,
          restaurantId,
          createdAt: { gte: from, lte: to },
          status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] as any },
        },
        _count: { id: true },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
      });

      const totalRevenue = rows.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0);

      return rows.map((r) => ({
        method: r.method,
        transactions: r._count.id,
        revenue: +Number(r._sum.amount ?? 0).toFixed(2),
        percentage: totalRevenue > 0 ? +((Number(r._sum.amount ?? 0) / totalRevenue) * 100).toFixed(1) : 0,
      }));
    });
  }

  // ─── M9.7 Customer overview ───────────────────────────────────────────────────

  async getCustomerOverview(tenantId: string, restaurantId: string, query: AnalyticsQueryDto) {
    const { from, to } = this.parseDateRange(query);
    const limit = query.limit ?? 10;
    const key = this.cacheKey(restaurantId, 'customers', query);

    return this.cached(key, 300, async () => {
      type SpenderRow = { customer_id: string; firstName: string; lastName: string | null; orders: bigint; revenue: number };

      const [newCustomers, totalCustomers, topSpenders] = await Promise.all([
        this.prisma.customer.count({
          where: { tenantId, restaurantId, createdAt: { gte: from, lte: to } },
        }),
        this.prisma.customer.count({ where: { tenantId, restaurantId } }),
        this.prisma.$queryRaw<SpenderRow[]>`
          SELECT
            c.id                          AS customer_id,
            c."firstName",
            c."lastName",
            COUNT(o.id)::bigint           AS orders,
            COALESCE(SUM(o."totalAmount"), 0)::float AS revenue
          FROM customers c
          JOIN orders o ON o."customerId" = c.id
          WHERE c."tenantId"     = ${tenantId}
            AND c."restaurantId" = ${restaurantId}
            AND o."createdAt"   >= ${from}
            AND o."createdAt"   <= ${to}
            AND o.status NOT IN ('CANCELLED', 'REFUNDED')
          GROUP BY c.id, c."firstName", c."lastName"
          ORDER BY revenue DESC
          LIMIT ${limit}
        `,
      ]);

      return {
        newCustomers,
        totalCustomers,
        topSpenders: topSpenders.map((r, i) => ({
          rank: i + 1,
          customerId: r.customer_id,
          name: [r.firstName, r.lastName].filter(Boolean).join(' '),
          orders: Number(r.orders),
          revenue: +r.revenue.toFixed(2),
        })),
      };
    });
  }

  // ─── M9.8 Staff activity ──────────────────────────────────────────────────────

  async getStaffActivity(tenantId: string, restaurantId: string, query: AnalyticsQueryDto) {
    const { from, to } = this.parseDateRange(query);
    const key = this.cacheKey(restaurantId, 'staff', query);

    return this.cached(key, 300, async () => {
      type StaffRow = { user_id: string; firstName: string; lastName: string | null; role: string; orders: bigint; revenue: number };

      const rows = await this.prisma.$queryRaw<StaffRow[]>`
        SELECT
          u.id                                  AS user_id,
          u."firstName",
          u."lastName",
          u.role,
          COUNT(o.id)::bigint                    AS orders,
          COALESCE(SUM(o."totalAmount"), 0)::float AS revenue
        FROM users u
        JOIN orders o ON o."createdById" = u.id
        WHERE o."tenantId"     = ${tenantId}
          AND o."restaurantId" = ${restaurantId}
          AND o."createdAt"   >= ${from}
          AND o."createdAt"   <= ${to}
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY u.id, u."firstName", u."lastName", u.role
        ORDER BY revenue DESC
      `;

      return rows.map((r) => ({
        userId: r.user_id,
        name: [r.firstName, r.lastName].filter(Boolean).join(' '),
        role: r.role,
        orders: Number(r.orders),
        revenue: +r.revenue.toFixed(2),
        avgOrderValue: Number(r.orders) > 0 ? +(r.revenue / Number(r.orders)).toFixed(2) : 0,
      }));
    });
  }

  // ─── M9.9 Hourly sales heatmap ────────────────────────────────────────────────

  async getHourlySales(tenantId: string, restaurantId: string, query: AnalyticsQueryDto) {
    const { from, to } = this.parseDateRange(query);
    const key = this.cacheKey(restaurantId, 'hourly', query);

    return this.cached(key, 300, async () => {
      type HourRow = { hour: number; orders: bigint; revenue: number };

      const rows = await this.prisma.$queryRaw<HourRow[]>`
        SELECT
          EXTRACT(HOUR FROM "createdAt")::int       AS hour,
          COUNT(*)::bigint                           AS orders,
          COALESCE(SUM("totalAmount"), 0)::float     AS revenue
        FROM orders
        WHERE "tenantId"     = ${tenantId}
          AND "restaurantId" = ${restaurantId}
          AND "createdAt"   >= ${from}
          AND "createdAt"   <= ${to}
          AND status NOT IN ('CANCELLED', 'REFUNDED')
        GROUP BY hour
        ORDER BY hour
      `;

      const byHour: Record<number, { orders: number; revenue: number }> = {};
      rows.forEach((r) => {
        byHour[r.hour] = { orders: Number(r.orders), revenue: +r.revenue.toFixed(2) };
      });

      const heatmap = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        orders: byHour[h]?.orders ?? 0,
        revenue: byHour[h]?.revenue ?? 0,
      }));

      const peakHour = heatmap.reduce((best, h) => (h.orders > best.orders ? h : best), heatmap[0]);

      return { heatmap, peakHour };
    });
  }

  // ─── M9.10 Period comparison ──────────────────────────────────────────────────

  async comparePeriods(tenantId: string, restaurantId: string, query: AnalyticsQueryDto) {
    const { from, to } = this.parseDateRange(query);
    const key = this.cacheKey(restaurantId, 'compare', query);

    return this.cached(key, 300, async () => {
      const durationMs = to.getTime() - from.getTime();
      const prevTo   = new Date(from.getTime() - 1);
      const prevFrom = new Date(from.getTime() - durationMs - 1);
      prevFrom.setHours(0, 0, 0, 0);

      const fetchPeriod = async (pFrom: Date, pTo: Date) => {
        const where = { tenantId, restaurantId, createdAt: { gte: pFrom, lte: pTo } };
        const completedWhere = { ...where, status: { notIn: ['CANCELLED', 'REFUNDED'] as any } };

        const [revAgg, orders, newCustomers] = await Promise.all([
          this.prisma.order.aggregate({ where: completedWhere, _sum: { totalAmount: true }, _count: true }),
          this.prisma.order.count({ where }),
          this.prisma.customer.count({ where: { tenantId, restaurantId, createdAt: { gte: pFrom, lte: pTo } } }),
        ]);

        const revenue = Number(revAgg._sum.totalAmount ?? 0);
        const completed = revAgg._count;
        return {
          revenue: +revenue.toFixed(2),
          orders,
          completedOrders: completed,
          avgOrderValue: completed > 0 ? +(revenue / completed).toFixed(2) : 0,
          newCustomers,
        };
      };

      const [current, previous] = await Promise.all([
        fetchPeriod(from, to),
        fetchPeriod(prevFrom, prevTo),
      ]);

      const pctChange = (curr: number, prev: number) =>
        prev > 0 ? +((( curr - prev) / prev) * 100).toFixed(1) : null;

      return {
        currentPeriod:  { from, to, ...current },
        previousPeriod: { from: prevFrom, to: prevTo, ...previous },
        changes: {
          revenue:       pctChange(current.revenue, previous.revenue),
          orders:        pctChange(current.orders, previous.orders),
          avgOrderValue: pctChange(current.avgOrderValue, previous.avgOrderValue),
          newCustomers:  pctChange(current.newCustomers, previous.newCustomers),
        },
      };
    });
  }
}
