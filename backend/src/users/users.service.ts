import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../common/email/email.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UserRole } from '@prisma/client';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  // ─── M1.5 Staff CRUD ──────────────────────────────────────────────────────

  async createStaff(tenantId: string, createdByRole: UserRole, dto: CreateStaffDto) {
    // Only OWNER and MANAGER can create staff
    if (createdByRole !== UserRole.OWNER && createdByRole !== UserRole.MANAGER) {
      throw new ForbiddenException('Only owners and managers can create staff');
    }

    // Manager cannot create another Manager or above
    if (createdByRole === UserRole.MANAGER && dto.role === UserRole.MANAGER) {
      throw new ForbiddenException('Managers cannot create other managers');
    }

    // Validate email uniqueness within tenant
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { tenantId, email: dto.email },
      });
      if (existing) throw new ConflictException('Email already in use in this tenant');
    }

    // Resolve restaurantId
    let restaurantId = dto.restaurantId;
    if (!restaurantId) {
      const restaurant = await this.prisma.restaurant.findFirst({ where: { tenantId } });
      if (!restaurant) throw new NotFoundException('No restaurant found in tenant');
      restaurantId = restaurant.id;
    } else {
      const restaurant = await this.prisma.restaurant.findFirst({ where: { id: restaurantId, tenantId } });
      if (!restaurant) throw new NotFoundException('Restaurant not found');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        restaurantId,
        email: dto.email,
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        role: dto.role,
        isVerified: true, // staff are pre-verified by owner
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        restaurantId: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Send welcome email with temp password (non-blocking)
    if (dto.email) {
      const restaurant = await this.prisma.restaurant.findUnique({ where: { id: restaurantId } });
      this.email
        .sendStaffWelcomeEmail(dto.email, dto.firstName, restaurant?.name ?? 'the restaurant', dto.password)
        .catch((err) => this.logger.error(`Staff welcome email failed: ${err.message}`));
    }

    this.logger.log(`Staff created: ${user.email ?? user.phone} (${user.role}) in tenant ${tenantId}`);
    return user;
  }

  async listStaff(tenantId: string, restaurantId?: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        ...(restaurantId ? { restaurantId } : {}),
        role: { not: UserRole.SUPER_ADMIN },
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        restaurantId: true,
        isActive: true,
        isVerified: true,
        twoFaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
  }

  async getStaff(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        restaurantId: true,
        isActive: true,
        isVerified: true,
        twoFaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        rolePerms: {
          include: { permission: true },
        },
      },
    });

    if (!user) throw new NotFoundException('Staff member not found');
    return user;
  }

  async updateStaff(tenantId: string, userId: string, callerRole: UserRole, dto: UpdateStaffDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('Staff member not found');

    // Managers cannot update owners or other managers
    if (callerRole === UserRole.MANAGER &&
        (user.role === UserRole.OWNER || user.role === UserRole.MANAGER)) {
      throw new ForbiddenException('Insufficient permissions to update this user');
    }

    const newPasswordHash = dto.password
      ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS)
      : undefined;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.role && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(newPasswordHash && { passwordHash: newPasswordHash }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    return updated;
  }

  async deactivateStaff(tenantId: string, userId: string, callerRole: UserRole) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('Staff member not found');

    if (user.role === UserRole.OWNER) {
      throw new ForbiddenException('Cannot deactivate the owner account');
    }

    if (callerRole === UserRole.MANAGER && user.role === UserRole.MANAGER) {
      throw new ForbiddenException('Managers cannot deactivate other managers');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    // Revoke all sessions
    await this.prisma.userSession.deleteMany({ where: { userId } });

    return { message: 'Staff member deactivated' };
  }

  // ─── M1.6 Permission Management ───────────────────────────────────────────

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  async grantPermission(tenantId: string, targetUserId: string, permissionId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: targetUserId, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    const permission = await this.prisma.permission.findUnique({ where: { id: permissionId } });
    if (!permission) throw new NotFoundException('Permission not found');

    const existing = await this.prisma.rolePermission.findUnique({
      where: { userId_permissionId: { userId: targetUserId, permissionId } },
    });

    if (existing) return { message: 'Permission already granted' };

    await this.prisma.rolePermission.create({
      data: { userId: targetUserId, permissionId },
    });

    return { message: `Permission '${permission.resource}:${permission.action}' granted` };
  }

  async revokePermission(tenantId: string, targetUserId: string, permissionId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: targetUserId, tenantId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.rolePermission.deleteMany({
      where: { userId: targetUserId, permissionId },
    });

    return { message: 'Permission revoked' };
  }

  async getUserPermissions(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { rolePerms: { include: { permission: true } } },
    });

    if (!user) throw new NotFoundException('User not found');
    return user.rolePerms.map((rp) => rp.permission);
  }
}
