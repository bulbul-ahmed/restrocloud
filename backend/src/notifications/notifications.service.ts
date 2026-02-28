import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { PushService } from '../push/push.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { MarkReadDto } from './dto/mark-read.dto';

// ─── Notification trigger parameters ─────────────────────────────────────────

export interface NotifyParams {
  tenantId: string;
  restaurantId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  /** Explicit recipient list — bypasses role-based lookup */
  targetUserIds?: string[];
  /** Find all users with these roles in the restaurant (when no targetUserIds) */
  targetRoles?: UserRole[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
    private push: PushService,
  ) {}

  // ─── M11.1 Core notify() — used internally by other services ─────────────

  async notify(params: NotifyParams): Promise<void> {
    const { tenantId, restaurantId, type, title, body, data, targetUserIds, targetRoles } = params;

    // Resolve recipients
    let recipientIds: string[] = targetUserIds ?? [];

    if (recipientIds.length === 0 && targetRoles && targetRoles.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { tenantId, restaurantId, isActive: true, role: { in: targetRoles } },
        select: { id: true },
      });
      recipientIds = users.map((u) => u.id);
    }

    if (recipientIds.length === 0) return;

    // Filter by notification preferences (muted types + push disabled)
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: recipientIds } },
    });
    const prefMap = new Map(prefs.map((p) => [p.userId, p]));

    const filteredIds = recipientIds.filter((uid) => {
      const pref = prefMap.get(uid);
      if (!pref) return true; // no prefs = all enabled by default
      if (!pref.pushEnabled) return false;
      const muted = (pref.mutedTypes as string[]) ?? [];
      if (muted.includes(type)) return false;
      return true;
    });

    if (filteredIds.length === 0) return;

    // Bulk-create notifications
    await this.prisma.notification.createMany({
      data: filteredIds.map((userId) => ({
        tenantId,
        restaurantId,
        userId,
        type,
        title,
        body,
        data: data ?? undefined,
      })),
    });

    // Emit realtime event to the restaurant room so connected clients can
    // update their notification badge without polling
    this.realtime.emitToTenant(tenantId, 'notification', {
      restaurantId,
      type,
      title,
      body,
      data,
      createdAt: new Date().toISOString(),
    });

    // Deliver push notification to registered mobile devices (M23.3 / M23.5)
    this.push.sendPushToUsers(filteredIds, title, body, { type, restaurantId, ...data }).catch(() => {});

    this.logger.log(
      `Notification [${type}] sent to ${filteredIds.length} user(s) in restaurant ${restaurantId}`,
    );
  }

  // ─── M11.2 List notifications (user-scoped) ───────────────────────────────

  async listNotifications(
    restaurantId: string,
    userId: string,
    tenantId: string,
    query: ListNotificationsQueryDto,
  ) {
    const { type, unreadOnly, page = 1, limit = 20 } = query;

    const where: any = { restaurantId, userId, tenantId };
    if (type) where.type = type;
    if (unreadOnly) where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { restaurantId, userId, tenantId, isRead: false } }),
    ]);

    return {
      data: notifications,
      unreadCount,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ─── M11.3 Unread count ───────────────────────────────────────────────────

  async getUnreadCount(restaurantId: string, userId: string, tenantId: string) {
    const count = await this.prisma.notification.count({
      where: { restaurantId, userId, tenantId, isRead: false },
    });
    return { unreadCount: count };
  }

  // ─── M11.4 Mark single notification as read ───────────────────────────────

  async markRead(id: string, userId: string, tenantId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId, tenantId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.isRead) return notification;

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ─── M11.5 Mark multiple notifications as read ────────────────────────────

  async markManyRead(dto: MarkReadDto, userId: string, tenantId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id: { in: dto.ids }, userId, tenantId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { marked: count };
  }

  // ─── M11.6 Mark all as read ───────────────────────────────────────────────

  async markAllRead(restaurantId: string, userId: string, tenantId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { restaurantId, userId, tenantId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { marked: count };
  }

  // ─── M11.7 Delete a notification ─────────────────────────────────────────

  async deleteNotification(id: string, userId: string, tenantId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId, tenantId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notification deleted' };
  }

  // ─── M11.8 Get notification preferences ──────────────────────────────────

  async getPreferences(restaurantId: string, userId: string, tenantId: string) {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // Return defaults without creating a record
      return {
        userId,
        tenantId,
        restaurantId,
        pushEnabled: true,
        emailEnabled: true,
        mutedTypes: [],
        quietHoursStart: null,
        quietHoursEnd: null,
      };
    }

    return { ...prefs, mutedTypes: (prefs.mutedTypes as string[]) ?? [] };
  }

  // ─── M11.9 Update notification preferences ────────────────────────────────

  async updatePreferences(
    restaurantId: string,
    userId: string,
    tenantId: string,
    dto: UpdatePreferencesDto,
  ) {
    const data: any = {};
    if (dto.pushEnabled !== undefined) data.pushEnabled = dto.pushEnabled;
    if (dto.emailEnabled !== undefined) data.emailEnabled = dto.emailEnabled;
    if (dto.mutedTypes !== undefined) data.mutedTypes = dto.mutedTypes;
    if (dto.quietHoursStart !== undefined) data.quietHoursStart = dto.quietHoursStart;
    if (dto.quietHoursEnd !== undefined) data.quietHoursEnd = dto.quietHoursEnd;

    const prefs = await this.prisma.notificationPreference.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        tenantId,
        restaurantId,
        pushEnabled: dto.pushEnabled ?? true,
        emailEnabled: dto.emailEnabled ?? true,
        mutedTypes: dto.mutedTypes ?? [],
        quietHoursStart: dto.quietHoursStart,
        quietHoursEnd: dto.quietHoursEnd,
      },
    });

    return { ...prefs, mutedTypes: (prefs.mutedTypes as string[]) ?? [] };
  }

  // ─── M11.10 Admin: list notifications for restaurant ─────────────────────

  async listRestaurantNotifications(
    restaurantId: string,
    tenantId: string,
    query: ListNotificationsQueryDto,
  ) {
    const { type, page = 1, limit = 20 } = query;

    const where: any = { restaurantId, tenantId };
    if (type) where.type = type;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }
}
