import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { UserRole, LeaveStatus } from '@prisma/client';
import { UpdateEmployeeProfileDto } from './dto/update-employee-profile.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { ShiftQueryDto } from './dto/shift-query.dto';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { ManualTimeEntryDto } from './dto/manual-time-entry.dto';
import { TimeEntryQueryDto } from './dto/time-entry-query.dto';
import { LogTipDto } from './dto/log-tip.dto';
import { LeaveRequestDto } from './dto/leave-request.dto';
import { ReviewLeaveDto } from './dto/review-leave.dto';
import { LeaveQueryDto } from './dto/leave-query.dto';
import { LaborReportQueryDto } from './dto/labor-report-query.dto';

const MANAGER_ROLES: UserRole[] = [UserRole.MANAGER, UserRole.OWNER, UserRole.SUPER_ADMIN];

const EMPLOYEE_SELECT = {
  id: true,
  tenantId: true,
  restaurantId: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  // HR fields
  hireDate: true,
  employmentType: true,
  hourlyRate: true,
  monthlySalary: true,
  emergencyContact: true,
  emergencyPhone: true,
  bankAccount: true,
  hrNotes: true,
};

@Injectable()
export class HrService {
  private readonly logger = new Logger(HrService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ─── M22.1 — Employee Profiles ────────────────────────────────────────────────

  async listEmployees(tenantId: string, restaurantId: string, callerRole: UserRole) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    return this.prisma.user.findMany({
      where: {
        tenantId,
        restaurantId,
        role: { notIn: [UserRole.SUPER_ADMIN] },
      },
      select: EMPLOYEE_SELECT,
      orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
    });
  }

  async getEmployee(tenantId: string, restaurantId: string, userId: string, callerRole: UserRole) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, restaurantId },
      select: EMPLOYEE_SELECT,
    });
    if (!user) throw new NotFoundException('Employee not found');
    return user;
  }

  async updateEmployeeProfile(
    tenantId: string,
    restaurantId: string,
    userId: string,
    callerRole: UserRole,
    dto: UpdateEmployeeProfileDto,
  ) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, restaurantId },
    });
    if (!user) throw new NotFoundException('Employee not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.hireDate !== undefined && { hireDate: new Date(dto.hireDate) }),
        ...(dto.employmentType !== undefined && { employmentType: dto.employmentType }),
        ...(dto.hourlyRate !== undefined && { hourlyRate: dto.hourlyRate }),
        ...(dto.monthlySalary !== undefined && { monthlySalary: dto.monthlySalary }),
        ...(dto.emergencyContact !== undefined && { emergencyContact: dto.emergencyContact }),
        ...(dto.emergencyPhone !== undefined && { emergencyPhone: dto.emergencyPhone }),
        ...(dto.bankAccount !== undefined && { bankAccount: dto.bankAccount }),
        ...(dto.hrNotes !== undefined && { hrNotes: dto.hrNotes }),
      },
      select: EMPLOYEE_SELECT,
    });
  }

  // ─── M22.2 — Shift Scheduling ─────────────────────────────────────────────────

  private getWeekBounds(weekOf?: string): { start: Date; end: Date } {
    const d = weekOf ? new Date(weekOf) : new Date();
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return { start: mon, end: sun };
  }

  async listShifts(tenantId: string, restaurantId: string, query: ShiftQueryDto) {
    let dateFilter: { startsAt?: { gte?: Date; lte?: Date } } = {};
    if (query.weekOf || (!query.dateFrom && !query.dateTo)) {
      const { start, end } = this.getWeekBounds(query.weekOf);
      dateFilter = { startsAt: { gte: start, lte: end } };
    } else {
      if (query.dateFrom || query.dateTo) {
        dateFilter = {
          startsAt: {
            ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
            ...(query.dateTo && { lte: new Date(query.dateTo + 'T23:59:59') }),
          },
        };
      }
    }

    return this.prisma.shift.findMany({
      where: {
        tenantId,
        restaurantId,
        ...(query.userId && { userId: query.userId }),
        ...dateFilter,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: [{ startsAt: 'asc' }, { userId: 'asc' }],
    });
  }

  async createShift(
    tenantId: string,
    restaurantId: string,
    callerId: string,
    callerRole: UserRole,
    dto: CreateShiftDto,
  ) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    if (new Date(dto.startsAt) >= new Date(dto.endsAt)) {
      throw new BadRequestException('startsAt must be before endsAt');
    }
    // Verify employee belongs to same restaurant
    const employee = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId, restaurantId },
    });
    if (!employee) throw new NotFoundException('Employee not found in this restaurant');

    return this.prisma.shift.create({
      data: {
        tenantId,
        restaurantId,
        userId: dto.userId,
        role: dto.role,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        notes: dto.notes ?? null,
        createdBy: callerId,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });
  }

  async updateShift(
    tenantId: string,
    restaurantId: string,
    shiftId: string,
    callerRole: UserRole,
    dto: UpdateShiftDto,
  ) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, tenantId, restaurantId },
    });
    if (!shift) throw new NotFoundException('Shift not found');

    if (dto.startsAt && dto.endsAt && new Date(dto.startsAt) >= new Date(dto.endsAt)) {
      throw new BadRequestException('startsAt must be before endsAt');
    }

    return this.prisma.shift.update({
      where: { id: shiftId },
      data: {
        ...(dto.role && { role: dto.role }),
        ...(dto.startsAt && { startsAt: new Date(dto.startsAt) }),
        ...(dto.endsAt && { endsAt: new Date(dto.endsAt) }),
        ...(dto.status && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });
  }

  async deleteShift(
    tenantId: string,
    restaurantId: string,
    shiftId: string,
    callerRole: UserRole,
  ) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, tenantId, restaurantId },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    await this.prisma.shift.delete({ where: { id: shiftId } });
    return { deleted: true };
  }

  // ─── M22.3 — Clock In / Clock Out ────────────────────────────────────────────

  async clockIn(
    tenantId: string,
    restaurantId: string,
    userId: string,
    dto: ClockInDto,
  ) {
    const open = await this.prisma.timeEntry.findFirst({
      where: { tenantId, restaurantId, userId, clockOut: null },
    });
    if (open) throw new ConflictException('Already clocked in');

    const entry = await this.prisma.timeEntry.create({
      data: {
        tenantId,
        restaurantId,
        userId,
        clockIn: new Date(),
        shiftId: dto.shiftId ?? null,
        notes: dto.notes ?? null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Update linked shift status
    if (dto.shiftId) {
      await this.prisma.shift.updateMany({
        where: { id: dto.shiftId, tenantId },
        data: { status: 'IN_PROGRESS' },
      }).catch(() => {});
    }

    return entry;
  }

  async clockOut(
    tenantId: string,
    restaurantId: string,
    userId: string,
    dto: ClockOutDto,
  ) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: { tenantId, restaurantId, userId, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });
    if (!entry) throw new BadRequestException('Not clocked in');

    const now = new Date();
    const hoursWorked = (now.getTime() - entry.clockIn.getTime()) / 3_600_000;

    const updated = await this.prisma.timeEntry.update({
      where: { id: entry.id },
      data: {
        clockOut: now,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        ...(dto.notes && { notes: dto.notes }),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Complete linked shift
    if (entry.shiftId) {
      await this.prisma.shift.updateMany({
        where: { id: entry.shiftId, tenantId },
        data: { status: 'COMPLETED' },
      }).catch(() => {});
    }

    return updated;
  }

  async getActiveEntries(tenantId: string, restaurantId: string, callerRole: UserRole) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    return this.prisma.timeEntry.findMany({
      where: { tenantId, restaurantId, clockOut: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { clockIn: 'asc' },
    });
  }

  async addManualTimeEntry(
    tenantId: string,
    restaurantId: string,
    callerRole: UserRole,
    dto: ManualTimeEntryDto,
  ) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    const clockIn = new Date(dto.clockIn);
    const clockOut = new Date(dto.clockOut);
    if (clockIn >= clockOut) {
      throw new BadRequestException('clockIn must be before clockOut');
    }
    const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / 3_600_000;

    return this.prisma.timeEntry.create({
      data: {
        tenantId,
        restaurantId,
        userId: dto.userId,
        clockIn,
        clockOut,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        shiftId: dto.shiftId ?? null,
        notes: dto.notes ?? null,
        isManual: true,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async listTimeEntries(tenantId: string, restaurantId: string, callerRole: UserRole, query: TimeEntryQueryDto) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: any = {
      tenantId,
      restaurantId,
      ...(query.userId && { userId: query.userId }),
      ...(query.dateFrom || query.dateTo
        ? {
            clockIn: {
              ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
              ...(query.dateTo && { lte: new Date(query.dateTo + 'T23:59:59') }),
            },
          }
        : {}),
    };

    const [entries, total] = await this.prisma.$transaction([
      this.prisma.timeEntry.findMany({
        where,
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
        orderBy: { clockIn: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.timeEntry.count({ where }),
    ]);

    return { entries, total, page, limit };
  }

  async getMyCurrentEntry(tenantId: string, restaurantId: string, userId: string) {
    const open = await this.prisma.timeEntry.findFirst({
      where: { tenantId, restaurantId, userId, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });
    return { isClockedIn: !!open, entry: open ?? null };
  }

  // ─── M22.4 — Attendance Summary ───────────────────────────────────────────────

  async getAttendanceSummary(tenantId: string, restaurantId: string, callerRole: UserRole, dateFrom: string, dateTo: string) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    const from = new Date(dateFrom);
    const to = new Date(dateTo + 'T23:59:59');

    const [employees, shifts, entries] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId, restaurantId, isActive: true, role: { notIn: [UserRole.SUPER_ADMIN] } },
        select: { id: true, firstName: true, lastName: true, role: true },
      }),
      this.prisma.shift.findMany({
        where: { tenantId, restaurantId, startsAt: { gte: from, lte: to } },
      }),
      this.prisma.timeEntry.findMany({
        where: { tenantId, restaurantId, clockIn: { gte: from, lte: to } },
      }),
    ]);

    return employees.map(emp => {
      const empShifts = shifts.filter(s => s.userId === emp.id);
      const empEntries = entries.filter(e => e.userId === emp.id);

      const daysWorked = new Set(
        empEntries.map(e => e.clockIn.toISOString().slice(0, 10)),
      ).size;

      const totalHours = empEntries.reduce((sum, e) => sum + (e.hoursWorked ?? 0), 0);

      // Late arrivals: clock-in > 15 min after scheduled shift start
      const lateArrivals = empEntries.filter(e => {
        const linkedShift = empShifts.find(
          s => s.id === e.shiftId ||
               (Math.abs(s.startsAt.getTime() - e.clockIn.getTime()) < 2 * 3600_000 &&
                e.clockIn.toISOString().slice(0, 10) === s.startsAt.toISOString().slice(0, 10)),
        );
        if (!linkedShift) return false;
        return e.clockIn.getTime() - linkedShift.startsAt.getTime() > 15 * 60_000;
      }).length;

      const absences = empShifts.filter(s => s.status === 'MISSED').length;

      return {
        userId: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        role: emp.role,
        scheduledShifts: empShifts.length,
        daysWorked,
        totalHours: Math.round(totalHours * 100) / 100,
        lateArrivals,
        absences,
      };
    });
  }

  // ─── M22.5 — Overtime ────────────────────────────────────────────────────────

  async getOvertimeReport(tenantId: string, restaurantId: string, callerRole: UserRole, dateFrom: string, dateTo: string) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    const from = new Date(dateFrom);
    const to = new Date(dateTo + 'T23:59:59');

    const [employees, entries] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId, restaurantId, isActive: true, role: { notIn: [UserRole.SUPER_ADMIN] } },
        select: { id: true, firstName: true, lastName: true, role: true },
      }),
      this.prisma.timeEntry.findMany({
        where: { tenantId, restaurantId, clockIn: { gte: from, lte: to }, clockOut: { not: null } },
        orderBy: { clockIn: 'asc' },
      }),
    ]);

    return employees.map(emp => {
      const empEntries = entries.filter(e => e.userId === emp.id);

      // Group by ISO week
      const weekMap: Record<string, { hours: number; days: Record<string, number> }> = {};
      for (const e of empEntries) {
        const d = e.clockIn;
        const day = d.getDay();
        const mon = new Date(d);
        mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        mon.setHours(0, 0, 0, 0);
        const weekKey = mon.toISOString().slice(0, 10);
        const dayKey = d.toISOString().slice(0, 10);

        if (!weekMap[weekKey]) weekMap[weekKey] = { hours: 0, days: {} };
        weekMap[weekKey].hours += e.hoursWorked ?? 0;
        weekMap[weekKey].days[dayKey] = (weekMap[weekKey].days[dayKey] ?? 0) + (e.hoursWorked ?? 0);
      }

      const weeks = Object.entries(weekMap).map(([weekStart, data]) => {
        const regularHours = Math.min(40, data.hours);
        const overtimeHours = Math.max(0, data.hours - 40);
        const days = Object.entries(data.days).map(([date, hours]) => ({
          date,
          hours: Math.round(hours * 100) / 100,
          ot: Math.max(0, Math.round((hours - 8) * 100) / 100),
        }));
        return {
          weekStart,
          regularHours: Math.round(regularHours * 100) / 100,
          overtimeHours: Math.round(overtimeHours * 100) / 100,
          days,
        };
      });

      const totalHours = empEntries.reduce((s, e) => s + (e.hoursWorked ?? 0), 0);
      const overtimeHours = weeks.reduce((s, w) => s + w.overtimeHours, 0);

      return {
        userId: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        role: emp.role,
        totalHours: Math.round(totalHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        weeks,
      };
    });
  }

  // ─── M22.6 — Tip Tracking ────────────────────────────────────────────────────

  async logTip(tenantId: string, restaurantId: string, callerRole: UserRole, dto: LogTipDto) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    const employee = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId, restaurantId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.prisma.tipRecord.create({
      data: {
        tenantId,
        restaurantId,
        userId: dto.userId,
        amount: dto.amount,
        source: dto.source,
        orderId: dto.orderId ?? null,
        date: dto.date ? new Date(dto.date) : new Date(),
        notes: dto.notes ?? null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async listTips(
    tenantId: string,
    restaurantId: string,
    callerRole: UserRole,
    userId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    const where: any = {
      tenantId,
      restaurantId,
      ...(userId && { userId }),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo + 'T23:59:59') }),
            },
          }
        : {}),
    };

    const entries = await this.prisma.tipRecord.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { date: 'desc' },
    });

    // Summary by employee
    const summaryMap: Record<string, { userId: string; name: string; total: number }> = {};
    for (const e of entries) {
      if (!summaryMap[e.userId]) {
        summaryMap[e.userId] = {
          userId: e.userId,
          name: `${e.user.firstName} ${e.user.lastName}`,
          total: 0,
        };
      }
      summaryMap[e.userId].total += Number(e.amount);
    }

    return {
      entries,
      summary: Object.values(summaryMap).sort((a, b) => b.total - a.total),
    };
  }

  async deleteTip(tenantId: string, restaurantId: string, tipId: string, callerRole: UserRole) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    const tip = await this.prisma.tipRecord.findFirst({
      where: { id: tipId, tenantId, restaurantId },
    });
    if (!tip) throw new NotFoundException('Tip record not found');
    await this.prisma.tipRecord.delete({ where: { id: tipId } });
    return { deleted: true };
  }

  // ─── M22.7 — Labor Cost Report ────────────────────────────────────────────────

  async getLaborCostReport(
    tenantId: string,
    restaurantId: string,
    callerRole: UserRole,
    dto: LaborReportQueryDto,
  ) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }

    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = dto.dateFrom ?? today;
    const dateTo = dto.dateTo ?? today;

    const cacheKey = `hr:${restaurantId}:labor:${dateFrom}:${dateTo}`;
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached);

    const from = new Date(dateFrom);
    const to = new Date(dateTo + 'T23:59:59');

    const [employees, entries, revenueResult] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId, restaurantId, isActive: true, role: { notIn: [UserRole.SUPER_ADMIN] } },
        select: { id: true, firstName: true, lastName: true, role: true, hourlyRate: true, monthlySalary: true },
      }),
      this.prisma.timeEntry.findMany({
        where: { tenantId, restaurantId, clockIn: { gte: from, lte: to }, clockOut: { not: null } },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          tenantId,
          restaurantId,
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
          createdAt: { gte: from, lte: to },
        },
      }),
    ]);

    const totalRevenue = Number(revenueResult._sum.totalAmount ?? 0);

    const byEmployee = employees.map(emp => {
      const empEntries = entries.filter(e => e.userId === emp.id);
      const hoursWorked = empEntries.reduce((s, e) => s + (e.hoursWorked ?? 0), 0);

      let estimatedCost = 0;
      if (emp.hourlyRate) {
        estimatedCost = hoursWorked * Number(emp.hourlyRate);
      } else if (emp.monthlySalary) {
        // Daily rate = monthlySalary / 26 working days
        const daysWorked = new Set(empEntries.map(e => e.clockIn.toISOString().slice(0, 10))).size;
        estimatedCost = daysWorked * (Number(emp.monthlySalary) / 26);
      }

      return {
        userId: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        role: emp.role,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        hourlyRate: emp.hourlyRate ? Number(emp.hourlyRate) : null,
        monthlySalary: emp.monthlySalary ? Number(emp.monthlySalary) : null,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
      };
    });

    const totalLaborCost = byEmployee.reduce((s, e) => s + e.estimatedCost, 0);
    const laborCostPct = totalRevenue > 0 ? (totalLaborCost / totalRevenue) * 100 : 0;

    const report = {
      dateFrom,
      dateTo,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalLaborCost: Math.round(totalLaborCost * 100) / 100,
      laborCostPct: Math.round(laborCostPct * 100) / 100,
      byEmployee,
    };

    await this.redis.set(cacheKey, JSON.stringify(report), 120).catch(() => {});
    return report;
  }

  // ─── M22.8 — Leave Requests ───────────────────────────────────────────────────

  async createLeaveRequest(
    tenantId: string,
    restaurantId: string,
    userId: string,
    dto: LeaveRequestDto,
  ) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (start > end) throw new BadRequestException('startDate must be before or equal to endDate');

    const days = Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1;

    return this.prisma.leaveRequest.create({
      data: {
        tenantId,
        restaurantId,
        userId,
        type: dto.type,
        startDate: start,
        endDate: end,
        days,
        reason: dto.reason ?? null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async listLeaveRequests(
    tenantId: string,
    restaurantId: string,
    callerId: string,
    callerRole: UserRole,
    query: LeaveQueryDto,
  ) {
    const isManager = MANAGER_ROLES.includes(callerRole);

    const where: any = {
      tenantId,
      restaurantId,
      // Non-managers can only see their own
      userId: isManager ? (query.userId ?? undefined) : callerId,
      ...(query.status && { status: query.status }),
      ...(query.dateFrom || query.dateTo
        ? {
            startDate: {
              ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
              ...(query.dateTo && { lte: new Date(query.dateTo + 'T23:59:59') }),
            },
          }
        : {}),
    };

    return this.prisma.leaveRequest.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveLeave(
    tenantId: string,
    restaurantId: string,
    leaveId: string,
    managerId: string,
    callerRole: UserRole,
    dto: ReviewLeaveDto,
  ) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id: leaveId, tenantId, restaurantId },
    });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only PENDING requests can be approved');
    }

    return this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: LeaveStatus.APPROVED,
        reviewedBy: managerId,
        reviewedAt: new Date(),
        managerNote: dto.managerNote ?? null,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async rejectLeave(
    tenantId: string,
    restaurantId: string,
    leaveId: string,
    managerId: string,
    callerRole: UserRole,
    dto: ReviewLeaveDto,
  ) {
    if (!MANAGER_ROLES.includes(callerRole)) {
      throw new ForbiddenException('Manager role required');
    }
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id: leaveId, tenantId, restaurantId },
    });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only PENDING requests can be rejected');
    }

    return this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: LeaveStatus.REJECTED,
        reviewedBy: managerId,
        reviewedAt: new Date(),
        managerNote: dto.managerNote ?? null,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async cancelLeave(
    tenantId: string,
    restaurantId: string,
    leaveId: string,
    callerId: string,
    callerRole: UserRole,
  ) {
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id: leaveId, tenantId, restaurantId },
    });
    if (!leave) throw new NotFoundException('Leave request not found');

    // Staff can only cancel their own; managers can cancel any
    if (!MANAGER_ROLES.includes(callerRole) && leave.userId !== callerId) {
      throw new ForbiddenException('Cannot cancel another staff member\'s leave');
    }
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only PENDING requests can be cancelled');
    }

    return this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status: LeaveStatus.CANCELLED },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  // ─── Used by HrCronService ────────────────────────────────────────────────────

  async detectAndMarkMissedShifts(tenantId: string, restaurantId: string) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const scheduledYesterday = await this.prisma.shift.findMany({
      where: {
        tenantId,
        restaurantId,
        status: 'SCHEDULED',
        startsAt: { gte: yesterday, lte: endOfYesterday },
      },
    });

    for (const shift of scheduledYesterday) {
      const hasEntry = await this.prisma.timeEntry.findFirst({
        where: {
          userId: shift.userId,
          tenantId,
          clockIn: { gte: shift.startsAt, lte: shift.endsAt },
        },
      });
      if (!hasEntry) {
        await this.prisma.shift.update({
          where: { id: shift.id },
          data: { status: 'MISSED' },
        }).catch(() => {});
      }
    }
  }
}
