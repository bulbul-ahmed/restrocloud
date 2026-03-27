import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { TableStatus, SessionStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateFloorSectionDto } from './dto/create-floor-section.dto';
import { UpdateFloorSectionDto } from './dto/update-floor-section.dto';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { ListTablesQueryDto } from './dto/list-tables-query.dto';

const MANAGER_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN];
const STAFF_ROLES: UserRole[] = [
  UserRole.WAITER,
  UserRole.CASHIER,
  UserRole.MANAGER,
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
];

@Injectable()
export class TablesService {
  private readonly logger = new Logger(TablesService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
  ) {}

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async requireRestaurant(tenantId: string, restaurantId: string) {
    const r = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, tenantId },
    });
    if (!r) throw new NotFoundException('Restaurant not found');
    return r;
  }

  private async requireSection(tenantId: string, restaurantId: string, sectionId: string) {
    const section = await this.prisma.floorSection.findFirst({
      where: { id: sectionId, tenantId, restaurantId },
    });
    if (!section) throw new NotFoundException('Floor section not found');
    return section;
  }

  private async requireTable(tenantId: string, restaurantId: string, tableId: string) {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { id: tableId, tenantId, restaurantId },
      include: {
        floorSection: { select: { id: true, name: true } },
        sessions: {
          where: { status: { in: [SessionStatus.OPEN, SessionStatus.BILL_REQUESTED] } },
          orderBy: { openedAt: 'desc' },
          take: 1,
          include: {
            orders: {
              where: { status: { notIn: ['COMPLETED', 'CANCELLED'] as any } },
              include: { items: { include: { modifiers: true } } },
            },
          },
        },
      },
    });
    if (!table) throw new NotFoundException('Table not found');
    return table;
  }

  // ─── M5.1 Floor Sections ─────────────────────────────────────────────────

  async createSection(tenantId: string, restaurantId: string, role: UserRole, dto: CreateFloorSectionDto) {
    if (!MANAGER_ROLES.includes(role)) throw new ForbiddenException('MANAGER or higher role required');
    await this.requireRestaurant(tenantId, restaurantId);

    const section = await this.prisma.floorSection.create({
      data: {
        tenantId,
        restaurantId,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { _count: { select: { tables: true } } },
    });

    this.logger.log(`Floor section "${dto.name}" created for restaurant ${restaurantId}`);
    return section;
  }

  async listSections(tenantId: string, restaurantId: string) {
    await this.requireRestaurant(tenantId, restaurantId);

    return this.prisma.floorSection.findMany({
      where: { tenantId, restaurantId },
      include: {
        _count: { select: { tables: true } },
        tables: {
          where: { isActive: true },
          orderBy: { tableNumber: 'asc' },
          select: {
              id: true, tableNumber: true, capacity: true, status: true,
              qrCode: true, posX: true, posY: true, isActive: true,
              sessions: {
                where: { status: { in: ['OPEN', 'BILL_REQUESTED'] } },
                orderBy: { openedAt: 'desc' },
                take: 1,
                select: { id: true, guestCount: true, status: true, openedAt: true },
              },
            },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getSection(tenantId: string, restaurantId: string, sectionId: string) {
    const section = await this.prisma.floorSection.findFirst({
      where: { id: sectionId, tenantId, restaurantId },
      include: {
        tables: {
          where: { isActive: true },
          orderBy: { tableNumber: 'asc' },
        },
      },
    });
    if (!section) throw new NotFoundException('Floor section not found');
    return section;
  }

  async updateSection(
    tenantId: string,
    restaurantId: string,
    sectionId: string,
    role: UserRole,
    dto: UpdateFloorSectionDto,
  ) {
    if (!MANAGER_ROLES.includes(role)) throw new ForbiddenException('MANAGER or higher role required');
    await this.requireSection(tenantId, restaurantId, sectionId);

    return this.prisma.floorSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteSection(tenantId: string, restaurantId: string, sectionId: string, role: UserRole) {
    if (!MANAGER_ROLES.includes(role)) throw new ForbiddenException('MANAGER or higher role required');
    await this.requireSection(tenantId, restaurantId, sectionId);

    const tableCount = await this.prisma.restaurantTable.count({
      where: { floorSectionId: sectionId, tenantId, isActive: true },
    });
    if (tableCount > 0) {
      throw new BadRequestException(
        `Cannot delete section with ${tableCount} active table(s). Deactivate or move tables first.`,
      );
    }

    await this.prisma.floorSection.delete({ where: { id: sectionId } });
  }

  // ─── M5.2 Tables ─────────────────────────────────────────────────────────

  async createTable(tenantId: string, restaurantId: string, role: UserRole, dto: CreateTableDto) {
    if (!MANAGER_ROLES.includes(role)) throw new ForbiddenException('MANAGER or higher role required');
    await this.requireRestaurant(tenantId, restaurantId);
    await this.requireSection(tenantId, restaurantId, dto.floorSectionId);

    // Ensure tableNumber is unique within the same section
    const existing = await this.prisma.restaurantTable.findFirst({
      where: { restaurantId, floorSectionId: dto.floorSectionId, tableNumber: dto.tableNumber, tenantId },
    });
    if (existing) throw new ConflictException(`Table number "${dto.tableNumber}" already exists in this section`);

    const table = await this.prisma.restaurantTable.create({
      data: {
        tenantId,
        restaurantId,
        floorSectionId: dto.floorSectionId,
        tableNumber: dto.tableNumber,
        capacity: dto.capacity ?? 2,
        posX: dto.posX,
        posY: dto.posY,
      },
      include: { floorSection: { select: { id: true, name: true } } },
    });

    this.logger.log(`Table ${dto.tableNumber} created in restaurant ${restaurantId}`);
    return table;
  }

  async listTables(tenantId: string, restaurantId: string, query: ListTablesQueryDto) {
    await this.requireRestaurant(tenantId, restaurantId);

    return this.prisma.restaurantTable.findMany({
      where: {
        tenantId,
        restaurantId,
        isActive: true,
        ...(query.floorSectionId && { floorSectionId: query.floorSectionId }),
        ...(query.status && { status: query.status }),
      },
      include: {
        floorSection: { select: { id: true, name: true } },
        sessions: {
          where: { status: { in: [SessionStatus.OPEN, SessionStatus.BILL_REQUESTED] } },
          take: 1,
          orderBy: { openedAt: 'desc' },
          select: { id: true, guestCount: true, status: true, openedAt: true },
        },
      },
      orderBy: [{ floorSection: { sortOrder: 'asc' } }, { tableNumber: 'asc' }],
    });
  }

  async getTable(tenantId: string, restaurantId: string, tableId: string) {
    return this.requireTable(tenantId, restaurantId, tableId);
  }

  async updateTable(
    tenantId: string,
    restaurantId: string,
    tableId: string,
    role: UserRole,
    dto: UpdateTableDto,
  ) {
    if (!MANAGER_ROLES.includes(role)) throw new ForbiddenException('MANAGER or higher role required');
    await this.requireTable(tenantId, restaurantId, tableId);

    return this.prisma.restaurantTable.update({
      where: { id: tableId },
      data: {
        ...(dto.tableNumber !== undefined && { tableNumber: dto.tableNumber }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.posX !== undefined && { posX: dto.posX }),
        ...(dto.posY !== undefined && { posY: dto.posY }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { floorSection: { select: { id: true, name: true } } },
    });
  }

  async deleteTable(tenantId: string, restaurantId: string, tableId: string, role: UserRole) {
    if (!MANAGER_ROLES.includes(role)) throw new ForbiddenException('MANAGER or higher role required');
    const table = await this.requireTable(tenantId, restaurantId, tableId);

    if (table.status === TableStatus.OCCUPIED) {
      throw new BadRequestException('Cannot delete an occupied table');
    }
    if (table.sessions.length > 0) {
      throw new BadRequestException('Cannot delete a table with an active session');
    }

    await this.prisma.restaurantTable.delete({ where: { id: tableId } });
  }

  // ─── M5.3 Table status ───────────────────────────────────────────────────

  async updateTableStatus(
    tenantId: string,
    restaurantId: string,
    tableId: string,
    role: UserRole,
    dto: UpdateTableStatusDto,
  ) {
    if (!STAFF_ROLES.includes(role)) throw new ForbiddenException('WAITER or higher role required');
    await this.requireTable(tenantId, restaurantId, tableId);

    const updated = await this.prisma.restaurantTable.update({
      where: { id: tableId },
      data: { status: dto.status },
    });

    this.realtime.emitToTenant(tenantId, 'table_status_changed', {
      tableId,
      restaurantId,
      status: dto.status,
      updatedAt: new Date().toISOString(),
    });

    return updated;
  }

  // ─── M5.4 Open table session ─────────────────────────────────────────────

  async openSession(
    tenantId: string,
    restaurantId: string,
    tableId: string,
    userId: string,
    role: UserRole,
    dto: OpenSessionDto,
  ) {
    if (!STAFF_ROLES.includes(role)) throw new ForbiddenException('WAITER or higher role required');
    const table = await this.requireTable(tenantId, restaurantId, tableId);

    // Prevent double-open
    if (table.sessions.length > 0) {
      throw new ConflictException('Table already has an active session');
    }
    if (table.status === TableStatus.OUT_OF_SERVICE) {
      throw new BadRequestException('Table is out of service');
    }

    const session = await this.prisma.$transaction(async (tx) => {
      await tx.restaurantTable.update({
        where: { id: tableId },
        data: { status: TableStatus.OCCUPIED },
      });

      return tx.tableSession.create({
        data: {
          tenantId,
          tableId,
          guestCount: dto.guestCount ?? 1,
          notes: dto.notes,
          status: SessionStatus.OPEN,
        },
        include: { table: { select: { id: true, tableNumber: true } } },
      });
    });

    this.realtime.emitToTenant(tenantId, 'table_status_changed', {
      tableId,
      restaurantId,
      status: TableStatus.OCCUPIED,
      sessionId: session.id,
      updatedAt: new Date().toISOString(),
    });

    this.logger.log(`Session opened for table ${table.tableNumber} — ${dto.guestCount ?? 1} guest(s)`);
    return session;
  }

  // ─── M5.5 Get current session ────────────────────────────────────────────

  async getCurrentSession(tenantId: string, restaurantId: string, tableId: string) {
    await this.requireTable(tenantId, restaurantId, tableId);

    const session = await this.prisma.tableSession.findFirst({
      where: {
        tableId,
        tenantId,
        status: { in: [SessionStatus.OPEN, SessionStatus.BILL_REQUESTED] },
      },
      orderBy: { openedAt: 'desc' },
      include: {
        table: { select: { id: true, tableNumber: true, capacity: true } },
        orders: {
          where: { status: { notIn: ['CANCELLED', 'REFUNDED'] as any } },
          include: {
            items: { include: { modifiers: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            payments: { where: { status: 'COMPLETED' }, select: { amount: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) throw new NotFoundException('No active session for this table');
    return session;
  }

  // ─── M5.6 Request bill ───────────────────────────────────────────────────

  async requestBill(
    tenantId: string,
    restaurantId: string,
    tableId: string,
    role: UserRole,
  ) {
    if (!STAFF_ROLES.includes(role)) throw new ForbiddenException('WAITER or higher role required');
    await this.requireTable(tenantId, restaurantId, tableId);

    const session = await this.prisma.tableSession.findFirst({
      where: { tableId, tenantId, status: SessionStatus.OPEN },
      orderBy: { openedAt: 'desc' },
    });
    if (!session) throw new NotFoundException('No open session found for this table');

    const updated = await this.prisma.tableSession.update({
      where: { id: session.id },
      data: { status: SessionStatus.BILL_REQUESTED },
      include: { table: { select: { id: true, tableNumber: true } } },
    });

    this.realtime.emitToTenant(tenantId, 'bill_requested', {
      tableId,
      restaurantId,
      sessionId: session.id,
      requestedAt: new Date().toISOString(),
    });

    return updated;
  }

  // ─── M5.7 Close session ──────────────────────────────────────────────────

  async closeSession(
    tenantId: string,
    restaurantId: string,
    tableId: string,
    sessionId: string,
    userId: string,
    role: UserRole,
    dto: CloseSessionDto,
  ) {
    if (!STAFF_ROLES.includes(role)) throw new ForbiddenException('WAITER or higher role required');
    await this.requireTable(tenantId, restaurantId, tableId);

    const session = await this.prisma.tableSession.findFirst({
      where: { id: sessionId, tableId, tenantId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status === SessionStatus.CLOSED) {
      throw new BadRequestException('Session is already closed');
    }

    // Check no unpaid orders remain — unless force-closing (MANAGER/OWNER only)
    const unpaidOrders = await this.prisma.order.count({
      where: {
        tableSessionId: sessionId,
        status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED'] as any },
      },
    });
    if (unpaidOrders > 0) {
      if (!dto.force) {
        throw new BadRequestException(
          `Cannot close session: ${unpaidOrders} order(s) are not yet completed or cancelled`,
        );
      }
      if (!MANAGER_ROLES.includes(role)) {
        throw new ForbiddenException('Only MANAGER or OWNER can force-close a session with active orders');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // If force-closing, cancel all active/pending orders first
      if (dto.force && unpaidOrders > 0) {
        await tx.order.updateMany({
          where: {
            tableSessionId: sessionId,
            status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED'] as any },
          },
          data: { status: 'CANCELLED' as any },
        });
      }

      await tx.tableSession.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.CLOSED,
          closedAt: new Date(),
          closedBy: userId,
          ...(dto.notes && { notes: dto.notes }),
        },
      });

      await tx.restaurantTable.update({
        where: { id: tableId },
        data: { status: TableStatus.CLEANING },
      });
    });

    this.realtime.emitToTenant(tenantId, 'table_status_changed', {
      tableId,
      restaurantId,
      status: TableStatus.CLEANING,
      updatedAt: new Date().toISOString(),
    });

    return { message: 'Session closed. Table set to CLEANING.' };
  }

  // ─── Table transfer ───────────────────────────────────────────────────────

  async transferSession(tenantId: string, restaurantId: string, tableId: string, targetTableId: string) {
    await this.requireTable(tenantId, restaurantId, tableId);

    const session = await this.prisma.tableSession.findFirst({
      where: { tableId, tenantId, status: { in: [SessionStatus.OPEN, SessionStatus.BILL_REQUESTED] } },
    });
    if (!session) throw new NotFoundException('No active session on this table');

    const targetTable = await this.prisma.restaurantTable.findFirst({
      where: { id: targetTableId, restaurantId, tenantId },
    });
    if (!targetTable) throw new NotFoundException('Target table not found');
    if (targetTable.status !== TableStatus.AVAILABLE) {
      throw new BadRequestException('Target table is not available');
    }

    await this.prisma.$transaction(async (tx) => {
      // Move the session to the target table
      await tx.tableSession.update({
        where: { id: session.id },
        data: { tableId: targetTableId },
      });
      // Move all orders in the session
      await tx.order.updateMany({
        where: { tableSessionId: session.id },
        data: { tableId: targetTableId },
      });
      // Free the source table
      await tx.restaurantTable.update({
        where: { id: tableId },
        data: { status: TableStatus.AVAILABLE },
      });
      // Occupy the target table
      await tx.restaurantTable.update({
        where: { id: targetTableId },
        data: { status: targetTable.status === TableStatus.AVAILABLE ? TableStatus.OCCUPIED : targetTable.status },
      });
    });

    return { success: true, fromTableId: tableId, toTableId: targetTableId };
  }

  // ─── M5.8 POS tables overview ────────────────────────────────────────────

  async getTablesOverview(tenantId: string, restaurantId: string) {
    await this.requireRestaurant(tenantId, restaurantId);

    const sections = await this.prisma.floorSection.findMany({
      where: { tenantId, restaurantId, isActive: true },
      include: {
        tables: {
          where: { isActive: true },
          orderBy: { tableNumber: 'asc' },
          include: {
            sessions: {
              where: { status: { in: [SessionStatus.OPEN, SessionStatus.BILL_REQUESTED] } },
              take: 1,
              orderBy: { openedAt: 'desc' },
              include: {
                orders: {
                  where: { status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED'] as any } },
                  select: { id: true, orderNumber: true, totalAmount: true, status: true, channel: true },
                },
              },
            },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Auto-repair: close orphaned active sessions on AVAILABLE tables
    const allTables = sections.flatMap((s) => s.tables);
    const orphanedSessionIds = allTables
      .filter((t) => t.status === TableStatus.AVAILABLE)
      .flatMap((t) => t.sessions.map((s) => s.id));
    if (orphanedSessionIds.length > 0) {
      await this.prisma.tableSession.updateMany({
        where: { id: { in: orphanedSessionIds } },
        data: { status: SessionStatus.CLOSED, closedAt: new Date() },
      });
      // Remove them from in-memory data so response is clean
      allTables.forEach((t) => {
        if (t.status === TableStatus.AVAILABLE) t.sessions = [];
      });
    }

    const summary = {
      total: allTables.length,
      available: allTables.filter((t) => t.status === TableStatus.AVAILABLE).length,
      occupied: allTables.filter((t) => t.status === TableStatus.OCCUPIED).length,
      reserved: allTables.filter((t) => t.status === TableStatus.RESERVED).length,
      cleaning: allTables.filter((t) => t.status === TableStatus.CLEANING).length,
      outOfService: allTables.filter((t) => t.status === TableStatus.OUT_OF_SERVICE).length,
    };

    return { summary, sections };
  }

  // ─── Legacy (keep for backwards compat) ──────────────────────────────────

  async findByRestaurant(tenantId: string, restaurantId: string) {
    return this.listSections(tenantId, restaurantId);
  }
}
