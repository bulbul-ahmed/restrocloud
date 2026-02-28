import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HrService } from './hr.service';
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('HR')
@ApiBearerAuth()
@Controller('restaurants/:restaurantId/hr')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(UserRole.STAFF)
export class HrController {
  constructor(private hrService: HrService) {}

  // ─── M22.1 — Employee Profiles ────────────────────────────────────────────────

  @Get('employees')
  @ApiOperation({ summary: 'List all employees with HR profile fields' })
  listEmployees(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
  ) {
    return this.hrService.listEmployees(user.tenantId, restaurantId, user.role);
  }

  @Get('employees/:userId')
  @ApiOperation({ summary: 'Get employee HR profile' })
  getEmployee(
    @Param('restaurantId') restaurantId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.hrService.getEmployee(user.tenantId, restaurantId, userId, user.role);
  }

  @Patch('employees/:userId')
  @ApiOperation({ summary: 'Update employee HR profile (hireDate, salary, emergency contact, etc.)' })
  updateEmployeeProfile(
    @Param('restaurantId') restaurantId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateEmployeeProfileDto,
  ) {
    return this.hrService.updateEmployeeProfile(user.tenantId, restaurantId, userId, user.role, dto);
  }

  // ─── M22.2 — Shift Scheduling ─────────────────────────────────────────────────

  @Get('shifts')
  @ApiOperation({ summary: 'List shifts (defaults to current week)' })
  listShifts(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Query() query: ShiftQueryDto,
  ) {
    return this.hrService.listShifts(user.tenantId, restaurantId, query);
  }

  @Post('shifts')
  @ApiOperation({ summary: 'Create a shift' })
  createShift(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateShiftDto,
  ) {
    return this.hrService.createShift(user.tenantId, restaurantId, user.id, user.role, dto);
  }

  @Patch('shifts/:shiftId')
  @ApiOperation({ summary: 'Update a shift' })
  updateShift(
    @Param('restaurantId') restaurantId: string,
    @Param('shiftId') shiftId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.hrService.updateShift(user.tenantId, restaurantId, shiftId, user.role, dto);
  }

  @Delete('shifts/:shiftId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a shift' })
  deleteShift(
    @Param('restaurantId') restaurantId: string,
    @Param('shiftId') shiftId: string,
    @CurrentUser() user: any,
  ) {
    return this.hrService.deleteShift(user.tenantId, restaurantId, shiftId, user.role);
  }

  // ─── M22.3 — Clock In / Clock Out ─────────────────────────────────────────────
  // IMPORTANT: static routes declared BEFORE /:id parameterized routes

  @Post('time/clock-in')
  @ApiOperation({ summary: 'Clock in (uses authenticated user)' })
  clockIn(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: ClockInDto,
  ) {
    return this.hrService.clockIn(user.tenantId, restaurantId, user.id, dto);
  }

  @Post('time/clock-out')
  @ApiOperation({ summary: 'Clock out (uses authenticated user)' })
  clockOut(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: ClockOutDto,
  ) {
    return this.hrService.clockOut(user.tenantId, restaurantId, user.id, dto);
  }

  @Get('time/active')
  @ApiOperation({ summary: 'List currently clocked-in employees (MANAGER+)' })
  getActiveEntries(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
  ) {
    return this.hrService.getActiveEntries(user.tenantId, restaurantId, user.role);
  }

  @Get('time/me')
  @ApiOperation({ summary: 'Get my current clock-in status' })
  getMyStatus(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
  ) {
    return this.hrService.getMyCurrentEntry(user.tenantId, restaurantId, user.id);
  }

  @Post('time/manual')
  @ApiOperation({ summary: 'Manager: manually add a time entry' })
  addManualEntry(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: ManualTimeEntryDto,
  ) {
    return this.hrService.addManualTimeEntry(user.tenantId, restaurantId, user.role, dto);
  }

  @Get('time')
  @ApiOperation({ summary: 'List time entries with filters (MANAGER+)' })
  listTimeEntries(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Query() query: TimeEntryQueryDto,
  ) {
    return this.hrService.listTimeEntries(user.tenantId, restaurantId, user.role, query);
  }

  // ─── M22.4 — Attendance ───────────────────────────────────────────────────────

  @Get('attendance/summary')
  @ApiOperation({ summary: 'Attendance summary per employee (MANAGER+)' })
  getAttendanceSummary(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    return this.hrService.getAttendanceSummary(
      user.tenantId,
      restaurantId,
      user.role,
      dateFrom ?? today,
      dateTo ?? today,
    );
  }

  // ─── M22.5 — Overtime ────────────────────────────────────────────────────────

  @Get('overtime')
  @ApiOperation({ summary: 'Overtime report (MANAGER+)' })
  getOvertimeReport(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    return this.hrService.getOvertimeReport(
      user.tenantId,
      restaurantId,
      user.role,
      dateFrom ?? today,
      dateTo ?? today,
    );
  }

  // ─── M22.6 — Tips ────────────────────────────────────────────────────────────

  @Post('tips')
  @ApiOperation({ summary: 'Log a tip record (MANAGER+)' })
  logTip(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: LogTipDto,
  ) {
    return this.hrService.logTip(user.tenantId, restaurantId, user.role, dto);
  }

  @Get('tips')
  @ApiOperation({ summary: 'List tips with summary by employee (MANAGER+)' })
  listTips(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Query('userId') userId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.hrService.listTips(user.tenantId, restaurantId, user.role, userId, dateFrom, dateTo);
  }

  @Delete('tips/:tipId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a tip record (MANAGER+)' })
  deleteTip(
    @Param('restaurantId') restaurantId: string,
    @Param('tipId') tipId: string,
    @CurrentUser() user: any,
  ) {
    return this.hrService.deleteTip(user.tenantId, restaurantId, tipId, user.role);
  }

  // ─── M22.7 — Labor Cost ───────────────────────────────────────────────────────

  @Get('reports/labor-cost')
  @ApiOperation({ summary: 'Labor cost vs revenue report (MANAGER+)' })
  getLaborCostReport(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Query() query: LaborReportQueryDto,
  ) {
    return this.hrService.getLaborCostReport(user.tenantId, restaurantId, user.role, query);
  }

  // ─── M22.8 — Leave Requests ───────────────────────────────────────────────────
  // IMPORTANT: static sub-routes (/leave/:id/approve, /leave/:id/reject)
  // are handled by NestJS route specificity — Patch with 3 segments wins over Patch with 2

  @Post('leave')
  @ApiOperation({ summary: 'Submit a leave request (any staff)' })
  createLeaveRequest(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Body() dto: LeaveRequestDto,
  ) {
    return this.hrService.createLeaveRequest(user.tenantId, restaurantId, user.id, dto);
  }

  @Get('leave')
  @ApiOperation({ summary: 'List leave requests (MANAGER: all; STAFF: own)' })
  listLeaveRequests(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
    @Query() query: LeaveQueryDto,
  ) {
    return this.hrService.listLeaveRequests(user.tenantId, restaurantId, user.id, user.role, query);
  }

  @Patch('leave/:leaveId/approve')
  @ApiOperation({ summary: 'Approve a leave request (MANAGER+)' })
  approveLeave(
    @Param('restaurantId') restaurantId: string,
    @Param('leaveId') leaveId: string,
    @CurrentUser() user: any,
    @Body() dto: ReviewLeaveDto,
  ) {
    return this.hrService.approveLeave(user.tenantId, restaurantId, leaveId, user.id, user.role, dto);
  }

  @Patch('leave/:leaveId/reject')
  @ApiOperation({ summary: 'Reject a leave request (MANAGER+)' })
  rejectLeave(
    @Param('restaurantId') restaurantId: string,
    @Param('leaveId') leaveId: string,
    @CurrentUser() user: any,
    @Body() dto: ReviewLeaveDto,
  ) {
    return this.hrService.rejectLeave(user.tenantId, restaurantId, leaveId, user.id, user.role, dto);
  }

  @Delete('leave/:leaveId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a leave request (staff: own PENDING only; manager: any)' })
  cancelLeave(
    @Param('restaurantId') restaurantId: string,
    @Param('leaveId') leaveId: string,
    @CurrentUser() user: any,
  ) {
    return this.hrService.cancelLeave(user.tenantId, restaurantId, leaveId, user.id, user.role);
  }
}
