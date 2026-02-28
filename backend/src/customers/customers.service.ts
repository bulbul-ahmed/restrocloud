import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { EarnPointsDto } from './dto/earn-points.dto';
import { RedeemPointsDto } from './dto/redeem-points.dto';

const MANAGER_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN];
const CASHIER_ROLES: UserRole[] = [UserRole.CASHIER, UserRole.MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN];

// Tier thresholds based on total points ever earned
const LOYALTY_TIERS = [
  { tier: 'PLATINUM', min: 10000 },
  { tier: 'GOLD',     min: 5000 },
  { tier: 'SILVER',   min: 1000 },
  { tier: 'BRONZE',   min: 0 },
];

function calcTier(totalEarned: number): string {
  return LOYALTY_TIERS.find((t) => totalEarned >= t.min)?.tier ?? 'BRONZE';
}

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  // ─── M8.1 Create customer ────────────────────────────────────────────────────

  async createCustomer(
    tenantId: string,
    restaurantId: string,
    userRole: UserRole,
    dto: CreateCustomerDto,
  ) {
    if (!CASHIER_ROLES.includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions. Required: CASHIER');
    }

    // Unique phone/email per restaurant
    if (dto.phone) {
      const existing = await this.prisma.customer.findUnique({
        where: { restaurantId_phone: { restaurantId, phone: dto.phone } },
      });
      if (existing) throw new ConflictException(`Phone ${dto.phone} already registered for this restaurant`);
    }

    if (dto.email) {
      const existing = await this.prisma.customer.findUnique({
        where: { restaurantId_email: { restaurantId, email: dto.email } },
      });
      if (existing) throw new ConflictException(`Email ${dto.email} already registered for this restaurant`);
    }

    const customer = await this.prisma.customer.create({
      data: {
        tenantId,
        restaurantId,
        firstName: dto.firstName,
        lastName: dto.lastName ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        notes: dto.notes ?? null,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      },
    });

    // Auto-create loyalty account
    await this.prisma.loyaltyAccount.create({
      data: { tenantId, customerId: customer.id, points: 0, totalEarned: 0, totalRedeemed: 0, tier: 'BRONZE' },
    });

    return this.prisma.customer.findUnique({
      where: { id: customer.id },
      include: { loyaltyAccount: true },
    });
  }

  // ─── M8.2 List customers ──────────────────────────────────────────────────────

  async listCustomers(tenantId: string, restaurantId: string, query: ListCustomersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { tenantId, restaurantId };

    if (query.search) {
      const s = query.search;
      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName:  { contains: s, mode: 'insensitive' } },
        { email:     { contains: s, mode: 'insensitive' } },
        { phone:     { contains: s, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: { loyaltyAccount: { select: { points: true, tier: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      customers,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── M8.3 Get customer detail ─────────────────────────────────────────────────

  async getCustomer(tenantId: string, restaurantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, restaurantId, tenantId },
      include: {
        addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
        loyaltyAccount: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 5 } } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  // ─── M8.4 Update customer ─────────────────────────────────────────────────────

  async updateCustomer(
    tenantId: string,
    restaurantId: string,
    customerId: string,
    userRole: UserRole,
    dto: UpdateCustomerDto,
  ) {
    if (!CASHIER_ROLES.includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions. Required: CASHIER');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, restaurantId, tenantId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Check uniqueness if updating phone/email
    if (dto.phone && dto.phone !== customer.phone) {
      const conflict = await this.prisma.customer.findUnique({
        where: { restaurantId_phone: { restaurantId, phone: dto.phone } },
      });
      if (conflict) throw new ConflictException(`Phone ${dto.phone} already registered`);
    }
    if (dto.email && dto.email !== customer.email) {
      const conflict = await this.prisma.customer.findUnique({
        where: { restaurantId_email: { restaurantId, email: dto.email } },
      });
      if (conflict) throw new ConflictException(`Email ${dto.email} already registered`);
    }

    return this.prisma.customer.update({
      where: { id: customerId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        notes: dto.notes,
        ...(dto.dateOfBirth !== undefined && {
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        }),
      },
    });
  }

  // ─── M8.5 Blacklist / unblacklist ─────────────────────────────────────────────

  async toggleBlacklist(
    tenantId: string,
    restaurantId: string,
    customerId: string,
    userRole: UserRole,
  ) {
    if (!MANAGER_ROLES.includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions. Required: MANAGER');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, restaurantId, tenantId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.customer.update({
      where: { id: customerId },
      data: { isBlacklisted: !customer.isBlacklisted },
      select: { id: true, firstName: true, lastName: true, isBlacklisted: true },
    });
  }

  // ─── M8.6 Address CRUD ────────────────────────────────────────────────────────

  async addAddress(tenantId: string, restaurantId: string, customerId: string, dto: CreateAddressDto) {
    await this.ensureCustomer(tenantId, restaurantId, customerId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        // Clear existing defaults
        await tx.address.updateMany({ where: { customerId, tenantId }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: {
          tenantId,
          customerId,
          label: dto.label ?? null,
          line1: dto.line1,
          line2: dto.line2 ?? null,
          city: dto.city,
          area: dto.area ?? null,
          postalCode: dto.postalCode ?? null,
          country: dto.country ?? 'BD',
          lat: dto.lat ?? null,
          lng: dto.lng ?? null,
          isDefault: dto.isDefault ?? false,
        },
      });
    });
  }

  async listAddresses(tenantId: string, restaurantId: string, customerId: string) {
    await this.ensureCustomer(tenantId, restaurantId, customerId);
    return this.prisma.address.findMany({
      where: { customerId, tenantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async updateAddress(
    tenantId: string,
    restaurantId: string,
    customerId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
    await this.ensureCustomer(tenantId, restaurantId, customerId);

    const addr = await this.prisma.address.findFirst({ where: { id: addressId, customerId, tenantId } });
    if (!addr) throw new NotFoundException('Address not found');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({ where: { customerId, tenantId }, data: { isDefault: false } });
      }
      return tx.address.update({ where: { id: addressId }, data: { ...dto } });
    });
  }

  async deleteAddress(tenantId: string, restaurantId: string, customerId: string, addressId: string) {
    await this.ensureCustomer(tenantId, restaurantId, customerId);

    const addr = await this.prisma.address.findFirst({ where: { id: addressId, customerId, tenantId } });
    if (!addr) throw new NotFoundException('Address not found');

    await this.prisma.address.delete({ where: { id: addressId } });
  }

  // ─── M8.7 Get loyalty account ────────────────────────────────────────────────

  async getLoyalty(tenantId: string, restaurantId: string, customerId: string) {
    await this.ensureCustomer(tenantId, restaurantId, customerId);

    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { customerId },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!account) throw new NotFoundException('Loyalty account not found');
    return account;
  }

  // ─── M8.8 Earn loyalty points ────────────────────────────────────────────────

  async earnPoints(
    tenantId: string,
    restaurantId: string,
    customerId: string,
    userRole: UserRole,
    dto: EarnPointsDto,
  ) {
    if (!CASHIER_ROLES.includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions. Required: CASHIER');
    }
    if (!dto.amount && !dto.points) {
      throw new BadRequestException('Provide either amount or points');
    }

    await this.ensureCustomer(tenantId, restaurantId, customerId);

    const pts = dto.points ?? Math.floor((dto.amount ?? 0) / 10);
    if (pts < 1) throw new BadRequestException('Calculated points must be at least 1');

    const account = await this.prisma.loyaltyAccount.findUnique({ where: { customerId } });
    if (!account) throw new NotFoundException('Loyalty account not found');

    const newTotalEarned = account.totalEarned + pts;
    const newTier = calcTier(newTotalEarned);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.loyaltyAccount.update({
        where: { customerId },
        data: {
          points: account.points + pts,
          totalEarned: newTotalEarned,
          tier: newTier,
        },
      });

      await tx.loyaltyTransaction.create({
        data: {
          tenantId,
          loyaltyAccountId: account.id,
          type: 'EARN',
          points: pts,
          description: dto.description ?? (dto.amount ? `Earned from ৳${dto.amount} purchase` : 'Manual credit'),
          orderId: dto.orderId ?? null,
        },
      });

      return { ...updated, earnedThisTransaction: pts };
    });
  }

  // ─── M8.9 Redeem loyalty points ──────────────────────────────────────────────

  async redeemPoints(
    tenantId: string,
    restaurantId: string,
    customerId: string,
    userRole: UserRole,
    dto: RedeemPointsDto,
  ) {
    if (!CASHIER_ROLES.includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions. Required: CASHIER');
    }

    await this.ensureCustomer(tenantId, restaurantId, customerId);

    const account = await this.prisma.loyaltyAccount.findUnique({ where: { customerId } });
    if (!account) throw new NotFoundException('Loyalty account not found');

    if (account.points < dto.points) {
      throw new BadRequestException(
        `Insufficient points. Available: ${account.points}, requested: ${dto.points}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.loyaltyAccount.update({
        where: { customerId },
        data: {
          points: account.points - dto.points,
          totalRedeemed: account.totalRedeemed + dto.points,
        },
      });

      await tx.loyaltyTransaction.create({
        data: {
          tenantId,
          loyaltyAccountId: account.id,
          type: 'REDEEM',
          points: -dto.points,
          description: dto.description ?? `Redeemed ${dto.points} points (৳${dto.points} discount)`,
          orderId: dto.orderId ?? null,
        },
      });

      return { ...updated, redeemedThisTransaction: dto.points, discountValue: dto.points };
    });
  }

  // ─── M8.10 Customer order history ────────────────────────────────────────────

  async getOrderHistory(tenantId: string, restaurantId: string, customerId: string, page = 1, limit = 20) {
    await this.ensureCustomer(tenantId, restaurantId, customerId);

    const skip = (page - 1) * limit;
    const where = { customerId, tenantId, restaurantId };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          channel: true,
          status: true,
          subtotal: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
          items: {
            where: { isVoid: false },
            select: { name: true, quantity: true, unitPrice: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private async ensureCustomer(tenantId: string, restaurantId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, restaurantId, tenantId },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }
}
