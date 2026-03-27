import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DeliveryStatus, NotificationType, OrderType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDeliveryZoneDto } from './dto/create-delivery-zone.dto';
import { UpdateDeliveryZoneDto } from './dto/update-delivery-zone.dto';
import { CreateDriverDto } from './dto/create-driver.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { UpdateDriverLocationDto } from './dto/update-driver-location.dto';
import { SubmitProofDto } from './dto/submit-proof.dto';
import { ListDeliveriesQueryDto } from './dto/list-deliveries-query.dto';
import { DeliveryAnalyticsQueryDto } from './dto/analytics-query.dto';

// ─── Status transition maps ──────────────────────────────────────────────────

const MANAGER_TRANSITIONS: Record<string, DeliveryStatus[]> = {
  [DeliveryStatus.PENDING]: [DeliveryStatus.ASSIGNED, DeliveryStatus.FAILED, DeliveryStatus.CANCELLED],
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.PICKED_UP, DeliveryStatus.FAILED, DeliveryStatus.CANCELLED],
  [DeliveryStatus.PICKED_UP]: [DeliveryStatus.IN_TRANSIT, DeliveryStatus.FAILED, DeliveryStatus.CANCELLED],
  [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED, DeliveryStatus.CANCELLED],
};

const DRIVER_TRANSITIONS: Record<string, DeliveryStatus[]> = {
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.PICKED_UP],
  [DeliveryStatus.PICKED_UP]: [DeliveryStatus.IN_TRANSIT],
  [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.DELIVERED],
};

const TERMINAL_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.DELIVERED,
  DeliveryStatus.FAILED,
  DeliveryStatus.CANCELLED,
];

const LOCATION_TTL = 300; // 5 minutes

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private realtime: RealtimeService,
    private notifications: NotificationsService,
  ) {}

  // ─── M18.2 Delivery Zones ─────────────────────────────────────────────────

  async listZones(tenantId: string, restaurantId: string) {
    return this.prisma.deliveryZone.findMany({
      where: { tenantId, restaurantId, isActive: true },
      orderBy: { radiusKm: 'asc' },
    });
  }

  async createZone(tenantId: string, restaurantId: string, dto: CreateDeliveryZoneDto) {
    return this.prisma.deliveryZone.create({
      data: {
        tenantId,
        restaurantId,
        name: dto.name,
        radiusKm: dto.radiusKm,
        extraFee: dto.extraFee ?? 0,
      },
    });
  }

  async updateZone(
    tenantId: string,
    restaurantId: string,
    zoneId: string,
    dto: UpdateDeliveryZoneDto,
  ) {
    const zone = await this.prisma.deliveryZone.findFirst({
      where: { id: zoneId, tenantId, restaurantId },
    });
    if (!zone) throw new NotFoundException('Delivery zone not found');

    return this.prisma.deliveryZone.update({
      where: { id: zoneId },
      data: dto,
    });
  }

  async deleteZone(tenantId: string, restaurantId: string, zoneId: string) {
    const zone = await this.prisma.deliveryZone.findFirst({
      where: { id: zoneId, tenantId, restaurantId },
    });
    if (!zone) throw new NotFoundException('Delivery zone not found');

    // Soft delete
    await this.prisma.deliveryZone.update({
      where: { id: zoneId },
      data: { isActive: false },
    });
    return { message: 'Zone deactivated' };
  }

  // ─── M18.3 Driver Management ──────────────────────────────────────────────

  async listDrivers(tenantId: string, restaurantId: string) {
    const drivers = await this.prisma.user.findMany({
      where: { tenantId, restaurantId, role: UserRole.DRIVER },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { firstName: 'asc' },
    });

    // Enrich with isOnline (Redis TTL check)
    const result = await Promise.all(
      drivers.map(async (d) => {
        const loc = await this.redis.getJson<any>(`driver:${d.id}:location`);
        return { ...d, isOnline: !!loc };
      }),
    );

    return result;
  }

  async createDriver(tenantId: string, restaurantId: string, dto: CreateDriverDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        tenantId,
        restaurantId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: UserRole.DRIVER,
        isVerified: true,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async toggleDriver(tenantId: string, restaurantId: string, driverId: string) {
    const driver = await this.prisma.user.findFirst({
      where: { id: driverId, tenantId, restaurantId, role: UserRole.DRIVER },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    return this.prisma.user.update({
      where: { id: driverId },
      data: { isActive: !driver.isActive },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });
  }

  // ─── M18.4 Create & List Deliveries ──────────────────────────────────────

  async createDelivery(tenantId: string, restaurantId: string, dto: CreateDeliveryDto) {
    // Validate order exists and is DELIVERY channel
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, tenantId, restaurantId },
      include: { delivery: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.channel !== OrderType.DELIVERY && order.channel !== OrderType.ONLINE) {
      throw new BadRequestException('Order must be a DELIVERY or ONLINE type');
    }
    if (order.delivery) {
      throw new ConflictException('Delivery already exists for this order');
    }

    // If driverId provided, validate driver
    if (dto.driverId) {
      const driver = await this.prisma.user.findFirst({
        where: { id: dto.driverId, tenantId, restaurantId, role: UserRole.DRIVER },
      });
      if (!driver) throw new BadRequestException('Invalid driver ID');
    }

    // If zoneId provided, validate zone
    if (dto.zoneId) {
      const zone = await this.prisma.deliveryZone.findFirst({
        where: { id: dto.zoneId, tenantId, restaurantId, isActive: true },
      });
      if (!zone) throw new BadRequestException('Invalid or inactive zone');
    }

    const delivery = await this.prisma.delivery.create({
      data: {
        tenantId,
        restaurantId,
        orderId: dto.orderId,
        driverId: dto.driverId,
        zoneId: dto.zoneId,
        estimatedAt: dto.estimatedAt ? new Date(dto.estimatedAt) : undefined,
        notes: dto.notes,
        status: dto.driverId ? DeliveryStatus.ASSIGNED : DeliveryStatus.PENDING,
        assignedAt: dto.driverId ? new Date() : undefined,
      },
      include: {
        order: { select: { orderNumber: true, totalAmount: true, deliveryAddress: true } },
        driver: { select: { id: true, firstName: true, lastName: true } },
        zone: true,
      },
    });

    this.realtime.emitToRestaurant(restaurantId, 'delivery:created', {
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      status: delivery.status,
    });

    return delivery;
  }

  async listDeliveries(
    tenantId: string,
    restaurantId: string,
    query: ListDeliveriesQueryDto,
  ) {
    const { status, driverId, date, page = 1, limit = 20 } = query;

    const where: any = { tenantId, restaurantId };
    if (status) where.status = status;
    if (driverId) where.driverId = driverId;
    if (date) {
      const from = new Date(date);
      const to = new Date(date);
      to.setDate(to.getDate() + 1);
      where.createdAt = { gte: from, lt: to };
    }

    const [data, total] = await Promise.all([
      this.prisma.delivery.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { orderNumber: true, totalAmount: true, deliveryAddress: true } },
          driver: { select: { id: true, firstName: true, lastName: true } },
          zone: { select: { id: true, name: true } },
        },
      }),
      this.prisma.delivery.count({ where }),
    ]);

    return { data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getDelivery(tenantId: string, restaurantId: string, deliveryId: string) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id: deliveryId, tenantId, restaurantId },
      include: {
        order: { select: { orderNumber: true, totalAmount: true, deliveryAddress: true, channel: true } },
        driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
        zone: true,
      },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    return delivery;
  }

  // ─── M18.5 Assign Driver ──────────────────────────────────────────────────

  async assignDriver(
    tenantId: string,
    restaurantId: string,
    deliveryId: string,
    dto: AssignDriverDto,
  ) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id: deliveryId, tenantId, restaurantId },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if ((TERMINAL_STATUSES as string[]).includes(delivery.status)) {
      throw new BadRequestException('Cannot assign driver to a terminal delivery');
    }

    const driver = await this.prisma.user.findFirst({
      where: { id: dto.driverId, tenantId, restaurantId, role: UserRole.DRIVER, isActive: true },
    });
    if (!driver) throw new BadRequestException('Invalid or inactive driver');

    const updated = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        driverId: dto.driverId,
        status: DeliveryStatus.ASSIGNED,
        assignedAt: new Date(),
        estimatedAt: dto.estimatedAt ? new Date(dto.estimatedAt) : delivery.estimatedAt,
      },
      include: {
        driver: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Notify relevant staff
    this.notifications
      .notify({
        tenantId,
        restaurantId,
        type: NotificationType.SYSTEM,
        title: 'Driver Assigned',
        body: `Driver ${driver.firstName} assigned to delivery #${deliveryId.slice(-8)}`,
        data: { action: 'DELIVERY_ASSIGNED', deliveryId },
        targetUserIds: [dto.driverId],
      })
      .catch(() => {});

    this.realtime.emitToRestaurant(restaurantId, 'delivery:status-changed', {
      deliveryId,
      status: DeliveryStatus.ASSIGNED,
      driverId: dto.driverId,
    });

    return updated;
  }

  // ─── M18.6 Manager Status State Machine ───────────────────────────────────

  async updateStatusByManager(
    tenantId: string,
    restaurantId: string,
    deliveryId: string,
    dto: UpdateDeliveryStatusDto,
  ) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id: deliveryId, tenantId, restaurantId },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');

    const allowed = MANAGER_TRANSITIONS[delivery.status] ?? [];
    if (!(allowed as string[]).includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${delivery.status} to ${dto.status}`,
      );
    }

    // PENDING→ASSIGNED requires a driver
    if (dto.status === DeliveryStatus.ASSIGNED && !delivery.driverId) {
      throw new BadRequestException('Assign a driver before moving to ASSIGNED status');
    }

    const timestampField = this.statusToTimestampField(dto.status);
    const data: any = {
      status: dto.status,
      notes: dto.notes ?? delivery.notes,
    };
    if (dto.failReason) data.failReason = dto.failReason;
    if (timestampField) data[timestampField] = new Date();

    const updated = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data,
    });

    this.realtime.emitToRestaurant(restaurantId, 'delivery:status-changed', {
      deliveryId,
      previousStatus: delivery.status,
      newStatus: dto.status,
    });

    this.notifications
      .notify({
        tenantId,
        restaurantId,
        type: NotificationType.SYSTEM,
        title: 'Delivery Status Changed',
        body: `Delivery #${deliveryId.slice(-8)} is now ${dto.status}`,
        data: { action: 'DELIVERY_STATUS_CHANGE', deliveryId, status: dto.status },
        targetRoles: [UserRole.MANAGER, UserRole.OWNER],
      })
      .catch(() => {});

    return updated;
  }

  // ─── M18.7 Driver Self-Service ────────────────────────────────────────────

  async getMyDeliveries(tenantId: string, restaurantId: string, driverId: string) {
    return this.prisma.delivery.findMany({
      where: {
        tenantId,
        restaurantId,
        driverId,
        status: { notIn: TERMINAL_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { orderNumber: true, deliveryAddress: true, totalAmount: true } },
        zone: { select: { id: true, name: true } },
      },
    });
  }

  async updateStatusByDriver(
    tenantId: string,
    restaurantId: string,
    deliveryId: string,
    dto: UpdateDeliveryStatusDto,
    driverId: string,
  ) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id: deliveryId, tenantId, restaurantId },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.driverId !== driverId) throw new ForbiddenException('Not your delivery');

    const allowed = DRIVER_TRANSITIONS[delivery.status] ?? [];
    if (!(allowed as string[]).includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${delivery.status} to ${dto.status}`,
      );
    }

    const timestampField = this.statusToTimestampField(dto.status);
    const data: any = { status: dto.status };
    if (timestampField) data[timestampField] = new Date();

    const updated = await this.prisma.delivery.update({
      where: { id: deliveryId },
      data,
    });

    this.realtime.emitToRestaurant(restaurantId, 'delivery:status-changed', {
      deliveryId,
      previousStatus: delivery.status,
      newStatus: dto.status,
      driverId,
    });

    return updated;
  }

  async submitProof(
    tenantId: string,
    restaurantId: string,
    deliveryId: string,
    dto: SubmitProofDto,
    driverId: string,
  ) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id: deliveryId, tenantId, restaurantId },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.driverId !== driverId) throw new ForbiddenException('Not your delivery');

    return this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        proofUrl: dto.proofUrl,
        proofNotes: dto.proofNotes,
      },
    });
  }

  // ─── M18.8 Driver Location ────────────────────────────────────────────────

  async updateDriverLocation(
    tenantId: string,
    restaurantId: string,
    deliveryId: string,
    dto: UpdateDriverLocationDto,
    driverId: string,
  ) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id: deliveryId, tenantId, restaurantId },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.driverId !== driverId) throw new ForbiddenException('Not your delivery');

    const locationData = {
      lat: dto.lat,
      lng: dto.lng,
      bearing: dto.bearing,
      timestamp: new Date().toISOString(),
      deliveryId,
    };

    await this.redis.setJson(`driver:${driverId}:location`, locationData, LOCATION_TTL);

    this.realtime.emitToRestaurant(restaurantId, 'delivery:driver-location', {
      deliveryId,
      driverId,
      ...locationData,
    });

    return { message: 'Location updated' };
  }

  async getDriverLocation(tenantId: string, restaurantId: string, deliveryId: string) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id: deliveryId, tenantId, restaurantId },
      select: { driverId: true, status: true },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');

    if (!delivery.driverId) {
      return { isOnline: false, lastLocation: null };
    }

    const loc = await this.redis.getJson<any>(`driver:${delivery.driverId}:location`);
    return { isOnline: !!loc, lastLocation: loc ?? null };
  }

  // ─── M18.9 Public Customer Tracking ───────────────────────────────────────

  async trackDelivery(deliveryId: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        driver: { select: { firstName: true } },
      },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');

    const loc = delivery.driverId
      ? await this.redis.getJson<any>(`driver:${delivery.driverId}:location`)
      : null;

    return {
      deliveryId: delivery.id,
      status: delivery.status,
      driverFirstName: delivery.driver?.firstName ?? null,
      estimatedAt: delivery.estimatedAt,
      deliveredAt: delivery.deliveredAt,
      lastLocation: loc ? { lat: loc.lat, lng: loc.lng, timestamp: loc.timestamp } : null,
    };
  }

  // ─── M18.10 Analytics ─────────────────────────────────────────────────────

  async getAnalytics(tenantId: string, restaurantId: string, query: DeliveryAnalyticsQueryDto) {
    const cacheKey = `delivery:analytics:${restaurantId}:${query.dateFrom ?? ''}:${query.dateTo ?? ''}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    const dateFilter: any = { tenantId, restaurantId };
    if (query.dateFrom || query.dateTo) {
      dateFilter.createdAt = {};
      if (query.dateFrom) dateFilter.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setDate(to.getDate() + 1);
        dateFilter.createdAt.lt = to;
      }
    }

    const [allDeliveries, completedDeliveries] = await Promise.all([
      this.prisma.delivery.groupBy({
        by: ['status'],
        where: dateFilter,
        _count: { id: true },
      }),
      this.prisma.delivery.findMany({
        where: { ...dateFilter, status: DeliveryStatus.DELIVERED },
        select: { assignedAt: true, deliveredAt: true, driverId: true },
      }),
    ]);

    // Deliveries by status
    const deliveriesByStatus = allDeliveries.map((g) => ({
      status: g.status,
      count: g._count.id,
    }));

    const total = deliveriesByStatus.reduce((s, g) => s + g.count, 0);
    const successCount =
      deliveriesByStatus.find((g) => g.status === DeliveryStatus.DELIVERED)?.count ?? 0;
    const successRatePercent = total > 0 ? Math.round((successCount / total) * 100) : 0;

    // Avg delivery minutes (assigned→delivered)
    let avgDeliveryMinutes = 0;
    const validDurations = completedDeliveries
      .filter((d) => d.assignedAt && d.deliveredAt)
      .map((d) => (d.deliveredAt!.getTime() - d.assignedAt!.getTime()) / 60000);
    if (validDurations.length > 0) {
      avgDeliveryMinutes = Math.round(
        validDurations.reduce((s, v) => s + v, 0) / validDurations.length,
      );
    }

    // Driver leaderboard
    const driverDeliveryCounts: Record<string, number> = {};
    completedDeliveries.forEach((d) => {
      if (d.driverId) {
        driverDeliveryCounts[d.driverId] = (driverDeliveryCounts[d.driverId] ?? 0) + 1;
      }
    });

    const topDriverIds = Object.entries(driverDeliveryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    const driverUsers = await this.prisma.user.findMany({
      where: { id: { in: topDriverIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const driverLeaderboard = topDriverIds.map((id) => {
      const u = driverUsers.find((u) => u.id === id);
      return {
        driverId: id,
        name: u ? `${u.firstName} ${u.lastName}` : 'Unknown',
        deliveries: driverDeliveryCounts[id],
      };
    });

    // Zone coverage
    const zoneCoverage = await this.prisma.delivery.groupBy({
      by: ['zoneId'],
      where: { ...dateFilter, zoneId: { not: null } },
      _count: { id: true },
    });

    const zoneIds = zoneCoverage.map((z) => z.zoneId).filter(Boolean) as string[];
    const zones = await this.prisma.deliveryZone.findMany({
      where: { id: { in: zoneIds } },
      select: { id: true, name: true },
    });

    const zoneCoverageResult = zoneCoverage.map((z) => ({
      zoneId: z.zoneId,
      zoneName: zones.find((zn) => zn.id === z.zoneId)?.name ?? 'Unknown',
      count: z._count.id,
    }));

    const result = {
      deliveriesByStatus,
      avgDeliveryMinutes,
      successRatePercent,
      driverLeaderboard,
      zoneCoverage: zoneCoverageResult,
    };

    await this.redis.setJson(cacheKey, result, 120);
    return result;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private statusToTimestampField(status: DeliveryStatus): string | null {
    const map: Record<string, string> = {
      [DeliveryStatus.ASSIGNED]: 'assignedAt',
      [DeliveryStatus.PICKED_UP]: 'pickedUpAt',
      [DeliveryStatus.IN_TRANSIT]: 'inTransitAt',
      [DeliveryStatus.DELIVERED]: 'deliveredAt',
      [DeliveryStatus.FAILED]: 'failedAt',
      [DeliveryStatus.CANCELLED]: 'cancelledAt',
    };
    return map[status] ?? null;
  }
}
