import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { UpdateHoursDto } from './dto/update-hours.dto';
import { UpdateTaxDto } from './dto/update-tax.dto';
import { UpdateServiceChargeDto } from './dto/update-service-charge.dto';
import { UpdateTipOptionsDto } from './dto/update-tip-options.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { UpdateOrderTypesDto } from './dto/update-order-types.dto';
import { UpdateAutoAcceptDto } from './dto/update-auto-accept.dto';
import { UpdateDeliverySettingsDto } from './dto/update-delivery-settings.dto';
import { UserRole } from '@prisma/client';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async findAndAuthorize(tenantId: string, restaurantId: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, tenantId },
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant;
  }

  private slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  private currencyForCountry(country?: string): string {
    const map: Record<string, string> = {
      BD: 'BDT', IN: 'INR', US: 'USD', GB: 'GBP',
      AE: 'AED', SA: 'SAR', MY: 'MYR', SG: 'SGD', PK: 'PKR',
    };
    return map[country ?? 'BD'] ?? 'USD';
  }

  private timezoneForCountry(country?: string): string {
    const map: Record<string, string> = {
      BD: 'Asia/Dhaka', IN: 'Asia/Kolkata', US: 'America/New_York',
      GB: 'Europe/London', AE: 'Asia/Dubai', MY: 'Asia/Kuala_Lumpur',
      SG: 'Asia/Singapore', PK: 'Asia/Karachi',
    };
    return map[country ?? 'BD'] ?? 'UTC';
  }

  // ─── M2.1 Profile CRUD ────────────────────────────────────────────────────

  async create(tenantId: string, callerRole: UserRole, dto: CreateRestaurantDto) {
    if (callerRole !== UserRole.OWNER) {
      throw new ForbiddenException('Only restaurant owners can create new branches');
    }

    let slug = this.slugify(dto.name);
    const existing = await this.prisma.restaurant.findFirst({ where: { tenantId, slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const restaurant = await this.prisma.restaurant.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
        description: dto.description,
        phone: dto.phone,
        email: dto.email,
        website: dto.website,
        address: dto.address,
        city: dto.city,
        country: dto.country ?? 'BD',
        currency: dto.currency ?? this.currencyForCountry(dto.country),
        timezone: dto.timezone ?? this.timezoneForCountry(dto.country),
        locale: dto.locale ?? 'en',
        orderTypes: dto.orderTypes ?? ['DINE_IN', 'TAKEAWAY'],
      },
    });

    this.logger.log(`Restaurant created: ${restaurant.name} (${restaurant.id})`);
    return restaurant;
  }

  async findByTenant(tenantId: string) {
    return this.prisma.restaurant.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(tenantId: string, restaurantId: string) {
    return this.findAndAuthorize(tenantId, restaurantId);
  }

  async update(tenantId: string, restaurantId: string, dto: UpdateRestaurantDto) {
    await this.findAndAuthorize(tenantId, restaurantId);
    const result = await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.logoWordmarkUrl !== undefined && { logoWordmarkUrl: dto.logoWordmarkUrl }),
        ...(dto.brandColor !== undefined && { brandColor: dto.brandColor }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.locale !== undefined && { locale: dto.locale }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.orderTypes !== undefined && { orderTypes: dto.orderTypes }),
      },
    });
    // Invalidate QR table resolve cache so brand color / profile changes reflect immediately
    await this.redis.flushPattern(`qr:resolve:${restaurantId}:*`).catch(() => {});
    return result;
  }

  async deactivate(tenantId: string, restaurantId: string) {
    await this.findAndAuthorize(tenantId, restaurantId);
    const activeCount = await this.prisma.restaurant.count({
      where: { tenantId, isActive: true },
    });
    if (activeCount <= 1) {
      throw new ForbiddenException('Cannot deactivate the only active restaurant in this tenant');
    }
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { isActive: false },
    });
  }

  // ─── M2.2 Operating Hours ─────────────────────────────────────────────────

  async updateHours(tenantId: string, restaurantId: string, dto: UpdateHoursDto) {
    const restaurant = await this.findAndAuthorize(tenantId, restaurantId);
    const existing = (restaurant.operatingHours as any) ?? {};
    const merged: any = { ...existing };
    if (dto.regularHours) {
      merged.regularHours = { ...(existing.regularHours ?? {}), ...dto.regularHours };
    }
    if (dto.holidayOverrides) {
      merged.holidayOverrides = { ...(existing.holidayOverrides ?? {}), ...dto.holidayOverrides };
    }
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { operatingHours: merged },
      select: { id: true, operatingHours: true },
    });
  }

  async isOpenNow(tenantId: string, restaurantId: string): Promise<{ open: boolean; reason?: string }> {
    const restaurant = await this.findAndAuthorize(tenantId, restaurantId);
    const hours = restaurant.operatingHours as any;
    if (!hours?.regularHours) return { open: true, reason: 'No hours configured' };

    const now = new Date(new Date().toLocaleString('en-US', { timeZone: restaurant.timezone }));
    const dateKey = now.toISOString().split('T')[0];

    if (hours.holidayOverrides?.[dateKey]) {
      const o = hours.holidayOverrides[dateKey];
      if (o.closed) return { open: false, reason: o.note ?? 'Holiday closure' };
    }

    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayHours = hours.regularHours?.[days[now.getDay()]];
    if (!dayHours) return { open: true, reason: 'Day not configured' };
    if (dayHours.closed) return { open: false, reason: `Closed today` };

    const [oH, oM] = (dayHours.open ?? '00:00').split(':').map(Number);
    const [cH, cM] = (dayHours.close ?? '23:59').split(':').map(Number);
    const cur = now.getHours() * 60 + now.getMinutes();
    const open = cur >= oH * 60 + oM && cur < cH * 60 + cM;
    return { open, reason: open ? undefined : `Opens at ${dayHours.open}` };
  }

  // ─── M2.3 Tax Configuration ───────────────────────────────────────────────

  async updateTax(tenantId: string, restaurantId: string, dto: UpdateTaxDto) {
    await this.findAndAuthorize(tenantId, restaurantId);
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
        ...(dto.taxInclusive !== undefined && { taxInclusive: dto.taxInclusive }),
      },
      select: { id: true, taxRate: true, taxInclusive: true },
    });
  }

  calculateTax(subtotal: number, taxRate: number, taxInclusive: boolean): number {
    if (taxRate === 0) return 0;
    if (taxInclusive) return subtotal - subtotal / (1 + taxRate / 100);
    return subtotal * (taxRate / 100);
  }

  // ─── M2.5 Service Charge ──────────────────────────────────────────────────

  async updateServiceCharge(tenantId: string, restaurantId: string, dto: UpdateServiceChargeDto) {
    await this.findAndAuthorize(tenantId, restaurantId);
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { serviceCharge: dto.serviceCharge },
      select: { id: true, serviceCharge: true },
    });
  }

  async updateDeliverySettings(tenantId: string, restaurantId: string, dto: UpdateDeliverySettingsDto) {
    await this.findAndAuthorize(tenantId, restaurantId);
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        ...(dto.deliveryFee !== undefined && { deliveryFee: dto.deliveryFee }),
        ...(dto.minimumOrderAmount !== undefined && { minimumOrderAmount: dto.minimumOrderAmount }),
      },
      select: { id: true, deliveryFee: true, minimumOrderAmount: true },
    });
  }

  // ─── M2.6 Tip Options ────────────────────────────────────────────────────

  async updateTipOptions(tenantId: string, restaurantId: string, dto: UpdateTipOptionsDto) {
    await this.findAndAuthorize(tenantId, restaurantId);
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { tipOptions: { percentages: dto.tipPercentages, allowCustom: dto.allowCustom } },
      select: { id: true, tipOptions: true },
    });
  }

  // ─── M2.7 Receipt Configuration ───────────────────────────────────────────

  async updateReceipt(tenantId: string, restaurantId: string, dto: UpdateReceiptDto) {
    const restaurant = await this.findAndAuthorize(tenantId, restaurantId);
    const existing = (restaurant.receiptConfig as any) ?? {};
    const merged = {
      ...existing,
      ...(dto.header !== undefined && { header: dto.header }),
      ...(dto.footer !== undefined && { footer: dto.footer }),
      ...(dto.showLogo !== undefined && { showLogo: dto.showLogo }),
      ...(dto.showTaxBreakdown !== undefined && { showTaxBreakdown: dto.showTaxBreakdown }),
      ...(dto.showWifi !== undefined && { showWifi: dto.showWifi }),
      ...(dto.wifiPassword !== undefined && { wifiPassword: dto.wifiPassword }),
    };
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { receiptConfig: merged },
      select: { id: true, receiptConfig: true },
    });
  }

  // ─── M2.8 Order Types ─────────────────────────────────────────────────────

  async updateOrderTypes(tenantId: string, restaurantId: string, dto: UpdateOrderTypesDto) {
    await this.findAndAuthorize(tenantId, restaurantId);
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { orderTypes: dto.orderTypes },
      select: { id: true, orderTypes: true },
    });
  }

  // ─── M2.9 Auto-Accept ─────────────────────────────────────────────────────

  async updateAutoAccept(tenantId: string, restaurantId: string, dto: UpdateAutoAcceptDto) {
    const restaurant = await this.findAndAuthorize(tenantId, restaurantId);
    const existing = (restaurant.autoAccept as any) ?? {};
    const merged = {
      ...existing,
      ...(dto.pos !== undefined && { pos: dto.pos }),
      ...(dto.qr !== undefined && { qr: dto.qr }),
      ...(dto.online !== undefined && { online: dto.online }),
      ...(dto.aggregator !== undefined && { aggregator: dto.aggregator }),
    };
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { autoAccept: merged },
      select: { id: true, autoAccept: true },
    });
  }

  // ─── M16.3 Auto-accept timer ──────────────────────────────────────────────

  async updateAutoAcceptTimer(tenantId: string, restaurantId: string, dto: Record<string, number>) {
    await this.findAndAuthorize(tenantId, restaurantId);
    const allowed = ['pos', 'qr', 'online', 'aggregator'];
    const minutes: Record<string, number> = {};
    for (const key of allowed) {
      if (typeof dto[key] === 'number' && dto[key] >= 0) {
        minutes[key] = Math.floor(dto[key]);
      }
    }
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { autoAcceptMinutes: minutes },
      select: { id: true, autoAccept: true, autoAcceptMinutes: true },
    });
  }

  async getAutoAcceptTimer(tenantId: string, restaurantId: string) {
    const restaurant = await this.findAndAuthorize(tenantId, restaurantId);
    return {
      autoAccept: restaurant.autoAccept,
      autoAcceptMinutes: restaurant.autoAcceptMinutes ?? { pos: 0, qr: 0, online: 0 },
    };
  }

  async updateQrBaseUrl(tenantId: string, restaurantId: string, qrBaseUrl: string | null) {
    await this.findAndAuthorize(tenantId, restaurantId);
    return this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { qrBaseUrl: qrBaseUrl || null },
      select: { id: true, qrBaseUrl: true },
    });
  }

  // ── Payment Gateways ────────────────────────────────────────────────────────

  async listPaymentGateways(tenantId: string, restaurantId: string) {
    await this.findAndAuthorize(tenantId, restaurantId);
    const configs = await this.prisma.paymentGatewayConfig.findMany({
      where: { tenantId, restaurantId },
      orderBy: { gateway: 'asc' },
    });
    // Mask secret fields — return only first 4 chars + ***
    return configs.map((c) => ({
      ...c,
      apiKey:        c.apiKey        ? c.apiKey.slice(0, 4) + '***'        : null,
      secretKey:     c.secretKey     ? c.secretKey.slice(0, 4) + '***'     : null,
      webhookSecret: c.webhookSecret ? c.webhookSecret.slice(0, 4) + '***' : null,
    }));
  }

  async upsertPaymentGateway(
    tenantId: string,
    restaurantId: string,
    gateway: string,
    dto: { apiKey?: string; secretKey?: string; webhookSecret?: string; isLive?: boolean; isActive?: boolean },
  ) {
    await this.findAndAuthorize(tenantId, restaurantId);
    const upper = gateway.toUpperCase();
    return this.prisma.paymentGatewayConfig.upsert({
      where: { restaurantId_gateway: { restaurantId, gateway: upper } },
      create: { tenantId, restaurantId, gateway: upper, ...dto },
      update: dto,
    });
  }
}
