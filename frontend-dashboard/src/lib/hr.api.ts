import { api } from '@/lib/api'
import type {
  Employee,
  Shift,
  TimeEntry,
  ClockStatus,
  TipRecord,
  TipSummary,
  LeaveRequest,
  AttendanceSummary,
  OvertimeReport,
  LaborCostReport,
} from '@/types/hr.types'

const BASE = (rid: string) => `/restaurants/${rid}/hr`
const unwrap = (r: any) => r.data.data ?? r.data

export const hrApi = {
  // ── M22.1 Employees ──────────────────────────────────────────────────────────
  listEmployees: (rid: string): Promise<Employee[]> =>
    api.get(`${BASE(rid)}/employees`).then(unwrap),

  getEmployee: (rid: string, userId: string): Promise<Employee> =>
    api.get(`${BASE(rid)}/employees/${userId}`).then(unwrap),

  updateEmployeeProfile: (rid: string, userId: string, body: Partial<Employee>): Promise<Employee> =>
    api.patch(`${BASE(rid)}/employees/${userId}`, body).then(unwrap),

  // ── M22.2 Shifts ─────────────────────────────────────────────────────────────
  listShifts: (
    rid: string,
    q?: { weekOf?: string; dateFrom?: string; dateTo?: string; userId?: string },
  ): Promise<Shift[]> =>
    api.get(`${BASE(rid)}/shifts`, { params: q }).then(unwrap),

  createShift: (
    rid: string,
    body: { userId: string; role: string; startsAt: string; endsAt: string; notes?: string },
  ): Promise<Shift> =>
    api.post(`${BASE(rid)}/shifts`, body).then(unwrap),

  updateShift: (rid: string, shiftId: string, body: object): Promise<Shift> =>
    api.patch(`${BASE(rid)}/shifts/${shiftId}`, body).then(unwrap),

  deleteShift: (rid: string, shiftId: string): Promise<{ deleted: boolean }> =>
    api.delete(`${BASE(rid)}/shifts/${shiftId}`).then(unwrap),

  // ── M22.3 Time entries ────────────────────────────────────────────────────────
  clockIn: (rid: string, body?: { shiftId?: string; notes?: string }): Promise<TimeEntry> =>
    api.post(`${BASE(rid)}/time/clock-in`, body ?? {}).then(unwrap),

  clockOut: (rid: string, body?: { notes?: string }): Promise<TimeEntry> =>
    api.post(`${BASE(rid)}/time/clock-out`, body ?? {}).then(unwrap),

  getActiveEntries: (rid: string): Promise<TimeEntry[]> =>
    api.get(`${BASE(rid)}/time/active`).then(unwrap),

  getMyStatus: (rid: string): Promise<ClockStatus> =>
    api.get(`${BASE(rid)}/time/me`).then(unwrap),

  addManualEntry: (
    rid: string,
    body: { userId: string; clockIn: string; clockOut: string; shiftId?: string; notes?: string },
  ): Promise<TimeEntry> =>
    api.post(`${BASE(rid)}/time/manual`, body).then(unwrap),

  listTimeEntries: (
    rid: string,
    q?: { userId?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number },
  ): Promise<{ entries: TimeEntry[]; total: number; page: number; limit: number }> =>
    api.get(`${BASE(rid)}/time`, { params: q }).then(unwrap),

  // ── M22.4 Attendance ─────────────────────────────────────────────────────────
  getAttendanceSummary: (
    rid: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<AttendanceSummary[]> =>
    api.get(`${BASE(rid)}/attendance/summary`, { params: { dateFrom, dateTo } }).then(unwrap),

  // ── M22.5 Overtime ────────────────────────────────────────────────────────────
  getOvertimeReport: (rid: string, dateFrom: string, dateTo: string): Promise<OvertimeReport[]> =>
    api.get(`${BASE(rid)}/overtime`, { params: { dateFrom, dateTo } }).then(unwrap),

  // ── M22.6 Tips ────────────────────────────────────────────────────────────────
  logTip: (
    rid: string,
    body: { userId: string; amount: number; source: string; orderId?: string; date?: string; notes?: string },
  ): Promise<TipRecord> =>
    api.post(`${BASE(rid)}/tips`, body).then(unwrap),

  listTips: (
    rid: string,
    q?: { userId?: string; dateFrom?: string; dateTo?: string },
  ): Promise<{ entries: TipRecord[]; summary: TipSummary[] }> =>
    api.get(`${BASE(rid)}/tips`, { params: q }).then(unwrap),

  deleteTip: (rid: string, tipId: string): Promise<{ deleted: boolean }> =>
    api.delete(`${BASE(rid)}/tips/${tipId}`).then(unwrap),

  // ── M22.7 Labor Cost ─────────────────────────────────────────────────────────
  getLaborCostReport: (
    rid: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<LaborCostReport> =>
    api.get(`${BASE(rid)}/reports/labor-cost`, { params: { dateFrom, dateTo } }).then(unwrap),

  // ── M22.8 Leave ───────────────────────────────────────────────────────────────
  createLeaveRequest: (
    rid: string,
    body: { type: string; startDate: string; endDate: string; reason?: string },
  ): Promise<LeaveRequest> =>
    api.post(`${BASE(rid)}/leave`, body).then(unwrap),

  listLeaveRequests: (
    rid: string,
    q?: { userId?: string; status?: string; dateFrom?: string; dateTo?: string },
  ): Promise<LeaveRequest[]> =>
    api.get(`${BASE(rid)}/leave`, { params: q }).then(unwrap),

  approveLeave: (rid: string, leaveId: string, body?: { managerNote?: string }): Promise<LeaveRequest> =>
    api.patch(`${BASE(rid)}/leave/${leaveId}/approve`, body ?? {}).then(unwrap),

  rejectLeave: (rid: string, leaveId: string, body?: { managerNote?: string }): Promise<LeaveRequest> =>
    api.patch(`${BASE(rid)}/leave/${leaveId}/reject`, body ?? {}).then(unwrap),

  cancelLeave: (rid: string, leaveId: string): Promise<LeaveRequest> =>
    api.delete(`${BASE(rid)}/leave/${leaveId}`).then(unwrap),
}
