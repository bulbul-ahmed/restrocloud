import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Users,
  Calendar,
  Clock,
  DollarSign,
  CalendarOff,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  LogIn,
  LogOut as LogOutIcon,
} from 'lucide-react'

import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

import { useAuthStore } from '@/store/auth.store'
import { hrApi } from '@/lib/hr.api'
import { apiError } from '@/lib/api'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type {
  Employee,
  Shift,
  LeaveRequest,
  LeaveType,
  LaborCostReport,
  OvertimeReport,
  AttendanceSummary,
} from '@/types/hr.types'

// ─── Constants ────────────────────────────────────────────────────────────────

type Tab = 'employees' | 'schedule' | 'time' | 'tips' | 'leave' | 'reports'

const ROLE_COLORS: Record<string, string> = {
  OWNER:    'bg-purple-100 text-purple-800',
  MANAGER:  'bg-blue-100 text-blue-800',
  CASHIER:  'bg-green-100 text-green-800',
  WAITER:   'bg-yellow-100 text-yellow-800',
  KITCHEN:  'bg-orange-100 text-orange-800',
  DRIVER:   'bg-cyan-100 text-cyan-800',
  STAFF:    'bg-gray-100 text-gray-700',
}

const SHIFT_STATUS_COLORS: Record<string, string> = {
  SCHEDULED:   'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-green-100 text-green-700',
  COMPLETED:   'bg-gray-100 text-gray-600',
  MISSED:      'bg-red-100 text-red-700',
  CANCELLED:   'bg-gray-100 text-gray-400',
}

const LEAVE_STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-800',
  APPROVED:  'bg-green-100 text-green-800',
  REJECTED:  'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

const LEAVE_TYPES: LeaveType[] = ['SICK', 'CASUAL', 'ANNUAL', 'UNPAID', 'OTHER']

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatHours(h: number | null | undefined): string {
  if (!h) return '—'
  const hrs = Math.floor(h)
  const min = Math.round((h - hrs) * 60)
  return min > 0 ? `${hrs}h ${min}m` : `${hrs}h`
}

// ─── Role Badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {role}
    </span>
  )
}

// ─── Edit Employee Profile Dialog ─────────────────────────────────────────────

function EditEmployeeDialog({
  restaurantId,
  employee,
  open,
  onClose,
}: {
  restaurantId: string
  employee: Employee
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    hireDate: employee.hireDate ? employee.hireDate.slice(0, 10) : '',
    employmentType: employee.employmentType ?? '',
    hourlyRate: employee.hourlyRate?.toString() ?? '',
    monthlySalary: employee.monthlySalary?.toString() ?? '',
    emergencyContact: employee.emergencyContact ?? '',
    emergencyPhone: employee.emergencyPhone ?? '',
    bankAccount: employee.bankAccount ?? '',
    hrNotes: employee.hrNotes ?? '',
  })

  const mut = useMutation({
    mutationFn: () =>
      hrApi.updateEmployeeProfile(restaurantId, employee.id, {
        hireDate: form.hireDate || undefined,
        employmentType: (form.employmentType as any) || undefined,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : undefined,
        emergencyContact: form.emergencyContact.trim() || undefined,
        emergencyPhone: form.emergencyPhone.trim() || undefined,
        bankAccount: form.bankAccount.trim() || undefined,
        hrNotes: form.hrNotes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees', restaurantId] })
      toast.success('Profile updated')
      onClose()
    },
    onError: (e) => toast.error(apiError(e)),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>HR Profile — {employee.firstName} {employee.lastName}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div>
            <Label>Hire Date</Label>
            <Input type="date" value={form.hireDate} onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))} />
          </div>
          <div>
            <Label>Employment Type</Label>
            <select
              value={form.employmentType}
              onChange={e => setForm(f => ({ ...f, employmentType: e.target.value }))}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">Select…</option>
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="CONTRACTOR">Contractor</option>
            </select>
          </div>
          <div>
            <Label>Hourly Rate (৳)</Label>
            <Input type="number" min={0} value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} placeholder="e.g. 150" />
          </div>
          <div>
            <Label>Monthly Salary (৳)</Label>
            <Input type="number" min={0} value={form.monthlySalary} onChange={e => setForm(f => ({ ...f, monthlySalary: e.target.value }))} placeholder="e.g. 25000" />
          </div>
          <div>
            <Label>Emergency Contact</Label>
            <Input value={form.emergencyContact} onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))} placeholder="Name" />
          </div>
          <div>
            <Label>Emergency Phone</Label>
            <Input value={form.emergencyPhone} onChange={e => setForm(f => ({ ...f, emergencyPhone: e.target.value }))} placeholder="+880..." />
          </div>
          <div className="col-span-2">
            <Label>Bank Account</Label>
            <Input value={form.bankAccount} onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))} placeholder="Bank, AC number" />
          </div>
          <div className="col-span-2">
            <Label>HR Notes</Label>
            <Textarea value={form.hrNotes} onChange={e => setForm(f => ({ ...f, hrNotes: e.target.value }))} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Employees Tab ────────────────────────────────────────────────────────────

function EmployeesTab({ restaurantId }: { restaurantId: string }) {
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['hr-employees', restaurantId],
    queryFn: () => hrApi.listEmployees(restaurantId),
    enabled: !!restaurantId,
  })

  if (isLoading) return <div className="p-6 text-sm text-gray-400">Loading…</div>

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Hire Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Rate</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Emergency</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {(employees as Employee[]).map(emp => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{emp.firstName} {emp.lastName}</div>
                  <div className="text-xs text-muted-foreground">{emp.email ?? emp.phone ?? '—'}</div>
                </td>
                <td className="px-4 py-3"><RoleBadge role={emp.role} /></td>
                <td className="px-4 py-3 text-gray-600">{emp.hireDate ? formatDate(emp.hireDate) : '—'}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{emp.employmentType?.replace('_', ' ') ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {emp.hourlyRate ? `৳${emp.hourlyRate}/hr` : emp.monthlySalary ? `৳${emp.monthlySalary}/mo` : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {emp.emergencyContact ? `${emp.emergencyContact}${emp.emergencyPhone ? ` · ${emp.emergencyPhone}` : ''}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {emp.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setEditEmployee(emp)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(employees as Employee[]).length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400 italic">No employees found</div>
        )}
      </div>

      {editEmployee && (
        <EditEmployeeDialog
          restaurantId={restaurantId}
          employee={editEmployee}
          open={!!editEmployee}
          onClose={() => setEditEmployee(null)}
        />
      )}
    </div>
  )
}

// ─── Create Shift Dialog ──────────────────────────────────────────────────────

function CreateShiftDialog({
  restaurantId,
  employees,
  defaultDate,
  open,
  onClose,
}: {
  restaurantId: string
  employees: Employee[]
  defaultDate: string
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    userId: '',
    role: 'STAFF',
    startsAt: defaultDate ? `${defaultDate}T09:00` : '',
    endsAt: defaultDate ? `${defaultDate}T17:00` : '',
    notes: '',
  })

  const mut = useMutation({
    mutationFn: () =>
      hrApi.createShift(restaurantId, {
        userId: form.userId,
        role: form.role,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-shifts', restaurantId] })
      toast.success('Shift created')
      onClose()
    },
    onError: (e) => toast.error(apiError(e)),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add Shift</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Employee *</Label>
            <select
              value={form.userId}
              onChange={e => {
                const emp = employees.find(x => x.id === e.target.value)
                setForm(f => ({ ...f, userId: e.target.value, role: emp?.role ?? 'STAFF' }))
              }}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">Select employee…</option>
              {employees.filter(e => e.isActive).map(e => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.role})</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Covering Role</Label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            >
              {['CASHIER', 'WAITER', 'KITCHEN', 'DRIVER', 'STAFF', 'MANAGER'].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Start Time *</Label>
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
            />
          </div>
          <div>
            <Label>End Time *</Label>
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={() => mut.mutate()} disabled={!form.userId || !form.startsAt || !form.endsAt || mut.isPending}>
            {mut.isPending ? 'Creating…' : 'Create Shift'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────

function ScheduleTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient()
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))
  const [createOpen, setCreateOpen] = useState(false)
  const [createDate, setCreateDate] = useState('')

  const weekOf = isoDate(weekStart)
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['hr-shifts', restaurantId, weekOf],
    queryFn: () => hrApi.listShifts(restaurantId, { weekOf }),
    enabled: !!restaurantId,
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees', restaurantId],
    queryFn: () => hrApi.listEmployees(restaurantId),
    enabled: !!restaurantId,
  })

  const deleteShiftMut = useMutation({
    mutationFn: (shiftId: string) => hrApi.deleteShift(restaurantId, shiftId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-shifts', restaurantId, weekOf] })
      toast.success('Shift removed')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  // Group shifts by employee, then by date
  const employeeIds = [...new Set((shifts as Shift[]).map(s => s.userId))]

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekStart(d => addDays(d, -7))}
            className="p-2 rounded hover:bg-gray-100 border"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-gray-900">
            {formatDate(weekStart)} — {formatDate(weekDates[6])}
          </span>
          <button
            onClick={() => setWeekStart(d => addDays(d, 7))}
            className="p-2 rounded hover:bg-gray-100 border"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="text-xs text-brand hover:underline"
          >
            This week
          </button>
        </div>
        <Button size="sm" onClick={() => { setCreateDate(isoDate(weekStart)); setCreateOpen(true) }}>
          <Plus size={14} className="mr-1" />Add Shift
        </Button>
      </div>

      {/* Weekly grid */}
      <div className="rounded-lg border bg-white overflow-hidden">
        {/* Header row */}
        <div className="grid bg-gray-50 border-b" style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}>
          <div className="px-3 py-2 text-xs font-semibold text-gray-600">Employee</div>
          {weekDates.map((d, i) => (
            <div
              key={i}
              className={cn(
                'px-2 py-2 text-center text-xs font-semibold border-l',
                isoDate(d) === isoDate(new Date()) ? 'bg-brand/10 text-brand' : 'text-gray-600',
              )}
            >
              <div>{WEEK_DAYS[i]}</div>
              <div className="text-gray-400 font-normal">{d.getDate()}</div>
            </div>
          ))}
        </div>

        {isLoading && <div className="p-6 text-sm text-gray-400 text-center">Loading…</div>}

        {!isLoading && employeeIds.length === 0 && (
          <div className="p-8 text-sm text-gray-400 italic text-center">No shifts scheduled this week</div>
        )}

        {employeeIds.map(uid => {
          const empShifts = (shifts as Shift[]).filter(s => s.userId === uid)
          const emp = empShifts[0]?.user
          return (
            <div
              key={uid}
              className="grid border-b last:border-b-0"
              style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}
            >
              <div className="px-3 py-2 flex items-center text-sm font-medium text-gray-800 border-r">
                {emp?.firstName} {emp?.lastName}
              </div>
              {weekDates.map((d, i) => {
                const dayShifts = empShifts.filter(s => isoDate(new Date(s.startsAt)) === isoDate(d))
                return (
                  <div key={i} className="px-1 py-1 border-l min-h-[56px]">
                    {dayShifts.map(s => (
                      <div
                        key={s.id}
                        className={cn(
                          'rounded px-1.5 py-1 text-xs mb-1 flex items-start justify-between gap-1',
                          SHIFT_STATUS_COLORS[s.status] ?? 'bg-gray-100',
                        )}
                      >
                        <div>
                          <div className="font-medium">{formatTime(s.startsAt)}</div>
                          <div className="opacity-80">{formatTime(s.endsAt)}</div>
                        </div>
                        <button
                          onClick={() => deleteShiftMut.mutate(s.id)}
                          className="opacity-60 hover:opacity-100 mt-0.5"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => { setCreateDate(isoDate(d)); setCreateOpen(true) }}
                      className="w-full text-center text-gray-300 hover:text-brand hover:bg-brand/5 rounded py-0.5 text-xs transition-colors"
                    >
                      +
                    </button>
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Empty row placeholder for adding */}
        {!isLoading && (
          <div
            className="grid border-t cursor-pointer hover:bg-gray-50"
            style={{ gridTemplateColumns: '160px repeat(7, 1fr)' }}
            onClick={() => { setCreateDate(isoDate(weekStart)); setCreateOpen(true) }}
          >
            <div className="px-3 py-2 text-xs text-brand flex items-center gap-1 border-r">
              <Plus size={12} /> Add employee shift
            </div>
            {weekDates.map((_, i) => <div key={i} className="border-l" />)}
          </div>
        )}
      </div>

      <CreateShiftDialog
        restaurantId={restaurantId}
        employees={employees as Employee[]}
        defaultDate={createDate}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  )
}

// ─── Time Tab ─────────────────────────────────────────────────────────────────

function TimeTab({ restaurantId, currentUserId }: { restaurantId: string; currentUserId: string }) {
  const qc = useQueryClient()
  const [dateFrom, setDateFrom] = useState(isoDate(new Date()))
  const [dateTo, setDateTo] = useState(isoDate(new Date()))
  const [manualOpen, setManualOpen] = useState(false)
  const [manualForm, setManualForm] = useState({ userId: '', clockIn: '', clockOut: '', notes: '' })

  const { data: myStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ['hr-my-status', restaurantId, currentUserId],
    queryFn: () => hrApi.getMyStatus(restaurantId),
    enabled: !!restaurantId,
    refetchInterval: 60_000,
  })

  const { data: activeEntries = [] } = useQuery({
    queryKey: ['hr-active', restaurantId],
    queryFn: () => hrApi.getActiveEntries(restaurantId),
    enabled: !!restaurantId,
    refetchInterval: 30_000,
  })

  const { data: timeData } = useQuery({
    queryKey: ['hr-time', restaurantId, dateFrom, dateTo],
    queryFn: () => hrApi.listTimeEntries(restaurantId, { dateFrom, dateTo, limit: 50 }),
    enabled: !!restaurantId,
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees', restaurantId],
    queryFn: () => hrApi.listEmployees(restaurantId),
    enabled: !!restaurantId,
  })

  const clockInMut = useMutation({
    mutationFn: () => hrApi.clockIn(restaurantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-my-status', restaurantId, currentUserId] })
      qc.invalidateQueries({ queryKey: ['hr-active', restaurantId] })
      toast.success('Clocked in!')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const clockOutMut = useMutation({
    mutationFn: () => hrApi.clockOut(restaurantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-my-status', restaurantId, currentUserId] })
      qc.invalidateQueries({ queryKey: ['hr-active', restaurantId] })
      toast.success('Clocked out!')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const manualMut = useMutation({
    mutationFn: () =>
      hrApi.addManualEntry(restaurantId, {
        userId: manualForm.userId,
        clockIn: new Date(manualForm.clockIn).toISOString(),
        clockOut: new Date(manualForm.clockOut).toISOString(),
        notes: manualForm.notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-time', restaurantId] })
      toast.success('Entry added')
      setManualOpen(false)
      setManualForm({ userId: '', clockIn: '', clockOut: '', notes: '' })
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const entries = timeData?.entries ?? []

  return (
    <div className="space-y-4">
      {/* My clock-in status */}
      <div className="rounded-lg border bg-white p-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">My Status</h3>
          {loadingStatus ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : myStatus?.isClockedIn ? (
            <div>
              <p className="text-sm text-green-700 font-medium">Clocked in since {formatTime(myStatus.entry!.clockIn)}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Not clocked in</p>
          )}
        </div>
        {myStatus?.isClockedIn ? (
          <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => clockOutMut.mutate()} disabled={clockOutMut.isPending}>
            <LogOutIcon size={14} className="mr-1" />{clockOutMut.isPending ? 'Clocking out…' : 'Clock Out'}
          </Button>
        ) : (
          <Button onClick={() => clockInMut.mutate()} disabled={clockInMut.isPending}>
            <LogIn size={14} className="mr-1" />{clockInMut.isPending ? 'Clocking in…' : 'Clock In'}
          </Button>
        )}
      </div>

      {/* Currently clocked in */}
      {(activeEntries as any[]).length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Currently Clocked In ({(activeEntries as any[]).length})</h3>
          <div className="flex flex-wrap gap-2">
            {(activeEntries as any[]).map((e: any) => (
              <span key={e.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {e.user.firstName} {e.user.lastName} · since {formatTime(e.clockIn)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Time entry history */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Time Entry History</h3>
          <div className="flex items-center gap-2">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 text-xs w-36" />
            <span className="text-xs text-gray-400">to</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 text-xs w-36" />
            <Button size="sm" variant="outline" onClick={() => setManualOpen(true)}>
              <Plus size={12} className="mr-1" />Manual
            </Button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Employee</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Clock In</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Clock Out</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Hours</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((e: any) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <span className="font-medium">{e.user.firstName} {e.user.lastName}</span>
                  {e.isManual && <span className="ml-1.5 text-2xs bg-gray-100 text-gray-500 px-1 rounded">manual</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-600">{formatDate(e.clockIn)} {formatTime(e.clockIn)}</td>
                <td className="px-4 py-2.5 text-gray-600">{e.clockOut ? formatTime(e.clockOut) : <span className="text-green-600 font-medium">Active</span>}</td>
                <td className="px-4 py-2.5 font-medium">{formatHours(e.hoursWorked)}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{e.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <div className="p-6 text-center text-sm text-gray-400 italic">No entries in this date range</div>}
      </div>

      {/* Manual entry dialog */}
      <Dialog open={manualOpen} onOpenChange={(v) => { if (!v) setManualOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Manual Time Entry</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Employee *</Label>
              <select
                value={manualForm.userId}
                onChange={e => setManualForm(f => ({ ...f, userId: e.target.value }))}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="">Select…</option>
                {(employees as Employee[]).filter(e => e.isActive).map(e => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Clock In *</Label>
              <Input type="datetime-local" value={manualForm.clockIn} onChange={e => setManualForm(f => ({ ...f, clockIn: e.target.value }))} />
            </div>
            <div>
              <Label>Clock Out *</Label>
              <Input type="datetime-local" value={manualForm.clockOut} onChange={e => setManualForm(f => ({ ...f, clockOut: e.target.value }))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={manualForm.notes} onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => manualMut.mutate()} disabled={!manualForm.userId || !manualForm.clockIn || !manualForm.clockOut || manualMut.isPending}>
              {manualMut.isPending ? 'Adding…' : 'Add Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Tips Tab ─────────────────────────────────────────────────────────────────

function TipsTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient()
  const [dateFrom, setDateFrom] = useState(isoDate(new Date()))
  const [dateTo, setDateTo] = useState(isoDate(new Date()))
  const [logOpen, setLogOpen] = useState(false)
  const [form, setForm] = useState({ userId: '', amount: '', source: 'CASH', notes: '' })

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees', restaurantId],
    queryFn: () => hrApi.listEmployees(restaurantId),
    enabled: !!restaurantId,
  })

  const { data: tipsData, isLoading } = useQuery({
    queryKey: ['hr-tips', restaurantId, dateFrom, dateTo],
    queryFn: () => hrApi.listTips(restaurantId, { dateFrom, dateTo }),
    enabled: !!restaurantId,
  })

  const logTipMut = useMutation({
    mutationFn: () =>
      hrApi.logTip(restaurantId, {
        userId: form.userId,
        amount: Number(form.amount),
        source: form.source,
        date: isoDate(new Date()),
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-tips', restaurantId] })
      toast.success('Tip logged')
      setForm({ userId: '', amount: '', source: 'CASH', notes: '' })
      setLogOpen(false)
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const deleteTipMut = useMutation({
    mutationFn: (tipId: string) => hrApi.deleteTip(restaurantId, tipId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-tips', restaurantId] })
      toast.success('Removed')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const entries = tipsData?.entries ?? []
  const summary = tipsData?.summary ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-sm w-36" />
          <span className="text-xs text-gray-400">to</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-sm w-36" />
        </div>
        <Button size="sm" onClick={() => setLogOpen(true)}><Plus size={14} className="mr-1" />Log Tip</Button>
      </div>

      {/* Summary by employee */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summary.map((s: any) => (
            <div key={s.userId} className="rounded-lg border bg-white p-3 text-center">
              <p className="text-sm font-bold text-gray-900">{formatCurrency(s.total)}</p>
              <p className="text-xs text-muted-foreground">{s.name}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Employee</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Amount</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Source</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Date</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Notes</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">Loading…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm italic">No tips logged</td></tr>
            ) : (
              entries.map((e: any) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">{e.user.firstName} {e.user.lastName}</td>
                  <td className="px-4 py-2.5 font-semibold text-green-700">{formatCurrency(Number(e.amount))}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">{e.source}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{formatDate(e.date)}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{e.notes || '—'}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => deleteTipMut.mutate(e.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={logOpen} onOpenChange={(v) => { if (!v) setLogOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Log Tip</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Employee *</Label>
              <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background">
                <option value="">Select…</option>
                {(employees as Employee[]).filter(e => e.isActive).map(e => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Amount (৳) *</Label>
              <Input type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 200" />
            </div>
            <div>
              <Label>Source</Label>
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background">
                <option value="CASH">Cash</option>
                <option value="ORDER">From Order</option>
                <option value="MANUAL">Manual</option>
              </select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => logTipMut.mutate()} disabled={!form.userId || !form.amount || logTipMut.isPending}>
              {logTipMut.isPending ? 'Logging…' : 'Log Tip'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Leave Tab ────────────────────────────────────────────────────────────────

function LeaveTab({ restaurantId, currentUserId, isManager }: { restaurantId: string; currentUserId: string; isManager: boolean }) {
  const qc = useQueryClient()
  const [requestOpen, setRequestOpen] = useState(false)
  const [form, setForm] = useState({ type: 'CASUAL' as LeaveType, startDate: '', endDate: '', reason: '' })
  const [noteDialog, setNoteDialog] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null)
  const [managerNote, setManagerNote] = useState('')

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['hr-leave', restaurantId],
    queryFn: () => hrApi.listLeaveRequests(restaurantId),
    enabled: !!restaurantId,
  })

  const createMut = useMutation({
    mutationFn: () =>
      hrApi.createLeaveRequest(restaurantId, {
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-leave', restaurantId] })
      toast.success('Leave request submitted')
      setForm({ type: 'CASUAL', startDate: '', endDate: '', reason: '' })
      setRequestOpen(false)
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const reviewMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      action === 'approve'
        ? hrApi.approveLeave(restaurantId, id, { managerNote: managerNote.trim() || undefined })
        : hrApi.rejectLeave(restaurantId, id, { managerNote: managerNote.trim() || undefined }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['hr-leave', restaurantId] })
      toast.success(vars.action === 'approve' ? 'Approved' : 'Rejected')
      setNoteDialog(null)
      setManagerNote('')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const cancelMut = useMutation({
    mutationFn: (id: string) => hrApi.cancelLeave(restaurantId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-leave', restaurantId] })
      toast.success('Request cancelled')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const pending = (requests as LeaveRequest[]).filter(r => r.status === 'PENDING')
  const others = (requests as LeaveRequest[]).filter(r => r.status !== 'PENDING')

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setRequestOpen(true)}><Plus size={14} className="mr-1" />Request Leave</Button>
      </div>

      {/* Pending requests (manager action needed) */}
      {isManager && pending.length > 0 && (
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-yellow-50 flex items-center gap-2">
            <AlertTriangle size={14} className="text-yellow-600" />
            <span className="text-sm font-semibold text-yellow-800">Pending Approval ({pending.length})</span>
          </div>
          <div className="divide-y">
            {pending.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium text-sm">{r.user.firstName} {r.user.lastName}</span>
                  <span className="mx-2 text-gray-300">·</span>
                  <span className="text-sm text-gray-600">{r.type}</span>
                  <span className="mx-2 text-gray-300">·</span>
                  <span className="text-sm text-gray-600">{formatDate(r.startDate)} — {formatDate(r.endDate)} ({r.days}d)</span>
                  {r.reason && <p className="text-xs text-gray-400 mt-0.5">"{r.reason}"</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => { setNoteDialog({ id: r.id, action: 'approve' }); setManagerNote('') }}>
                    <CheckCircle2 size={12} className="mr-1" />Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => { setNoteDialog({ id: r.id, action: 'reject' }); setManagerNote('') }}>
                    <XCircle size={12} className="mr-1" />Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All requests */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-gray-50">
          <span className="text-sm font-semibold text-gray-700">Leave Requests</span>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-gray-400 text-center">Loading…</div>
        ) : (requests as LeaveRequest[]).length === 0 ? (
          <div className="p-8 text-sm text-gray-400 italic text-center">No leave requests</div>
        ) : (
          <div className="divide-y">
            {(requests as LeaveRequest[]).map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  {isManager && <span className="font-medium text-sm mr-2">{r.user.firstName} {r.user.lastName}</span>}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LEAVE_STATUS_COLORS[r.status]}`}>{r.status}</span>
                  <span className="mx-2 text-gray-300">·</span>
                  <span className="text-sm text-gray-700">{r.type} · {r.days}d</span>
                  <span className="mx-2 text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{formatDate(r.startDate)} — {formatDate(r.endDate)}</span>
                  {r.reason && <p className="text-xs text-gray-400 mt-0.5">"{r.reason}"</p>}
                  {r.managerNote && <p className="text-xs text-gray-500 mt-0.5 italic">Note: {r.managerNote}</p>}
                </div>
                {r.status === 'PENDING' && r.userId === currentUserId && (
                  <Button size="sm" variant="outline" onClick={() => cancelMut.mutate(r.id)} disabled={cancelMut.isPending}>
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request leave dialog */}
      <Dialog open={requestOpen} onOpenChange={(v) => { if (!v) setRequestOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Leave Type *</Label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as LeaveType }))}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background">
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Start Date *</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <Label>End Date *</Label>
              <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => createMut.mutate()} disabled={!form.startDate || !form.endDate || createMut.isPending}>
              {createMut.isPending ? 'Submitting…' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager review dialog */}
      <Dialog open={!!noteDialog} onOpenChange={(v) => { if (!v) setNoteDialog(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{noteDialog?.action === 'approve' ? 'Approve' : 'Reject'} Leave Request</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Manager Note (optional)</Label>
            <Textarea value={managerNote} onChange={e => setManagerNote(e.target.value)} rows={2} placeholder="Add a note for the employee…" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              className={noteDialog?.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              variant={noteDialog?.action === 'reject' ? 'destructive' : 'default'}
              onClick={() => noteDialog && reviewMut.mutate(noteDialog)}
              disabled={reviewMut.isPending}
            >
              {reviewMut.isPending ? 'Saving…' : noteDialog?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab({ restaurantId }: { restaurantId: string }) {
  const today = isoDate(new Date())
  const firstOfMonth = `${today.slice(0, 7)}-01`

  const [laborFrom, setLaborFrom] = useState(firstOfMonth)
  const [laborTo, setLaborTo] = useState(today)
  const [laborEnabled, setLaborEnabled] = useState(false)

  const [otFrom, setOtFrom] = useState(firstOfMonth)
  const [otTo, setOtTo] = useState(today)
  const [otEnabled, setOtEnabled] = useState(false)

  const [attendFrom, setAttendFrom] = useState(firstOfMonth)
  const [attendTo, setAttendTo] = useState(today)
  const [attendEnabled, setAttendEnabled] = useState(false)

  const { data: labor, isFetching: loadingLabor } = useQuery({
    queryKey: ['hr-labor', restaurantId, laborFrom, laborTo],
    queryFn: () => hrApi.getLaborCostReport(restaurantId, laborFrom, laborTo),
    enabled: !!restaurantId && laborEnabled,
  })

  const { data: overtime, isFetching: loadingOt } = useQuery({
    queryKey: ['hr-overtime', restaurantId, otFrom, otTo],
    queryFn: () => hrApi.getOvertimeReport(restaurantId, otFrom, otTo),
    enabled: !!restaurantId && otEnabled,
  })

  const { data: attendance, isFetching: loadingAttend } = useQuery({
    queryKey: ['hr-attendance', restaurantId, attendFrom, attendTo],
    queryFn: () => hrApi.getAttendanceSummary(restaurantId, attendFrom, attendTo),
    enabled: !!restaurantId && attendEnabled,
  })

  const laborReport = labor as LaborCostReport | undefined
  const overtimeReport = overtime as OvertimeReport[] | undefined
  const attendReport = attendance as AttendanceSummary[] | undefined

  const laborColor =
    !laborReport ? 'text-gray-700' :
    laborReport.laborCostPct < 25 ? 'text-green-700' :
    laborReport.laborCostPct < 35 ? 'text-yellow-700' : 'text-red-700'

  return (
    <div className="space-y-6">
      {/* Labor Cost Report */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <DollarSign size={15} /> Labor Cost vs Revenue
        </h3>
        <div className="flex items-center gap-2 mb-4">
          <Input type="date" value={laborFrom} onChange={e => setLaborFrom(e.target.value)} className="h-8 text-sm w-36" />
          <span className="text-xs text-gray-400">to</span>
          <Input type="date" value={laborTo} onChange={e => setLaborTo(e.target.value)} className="h-8 text-sm w-36" />
          <Button size="sm" onClick={() => setLaborEnabled(true)} disabled={loadingLabor}>
            {loadingLabor ? 'Loading…' : 'Run Report'}
          </Button>
        </div>

        {laborReport && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg bg-gray-50 border p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{formatCurrency(laborReport.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Revenue</p>
              </div>
              <div className="rounded-lg bg-gray-50 border p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{formatCurrency(laborReport.totalLaborCost)}</p>
                <p className="text-xs text-muted-foreground">Labor Cost</p>
              </div>
              <div className="rounded-lg bg-gray-50 border p-3 text-center">
                <p className={`text-2xl font-bold ${laborColor}`}>{laborReport.laborCostPct.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Labor %</p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Employee</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Role</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Hours</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Rate</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {laborReport.byEmployee.map(e => (
                  <tr key={e.userId}>
                    <td className="px-3 py-2 font-medium">{e.name}</td>
                    <td className="px-3 py-2"><RoleBadge role={e.role} /></td>
                    <td className="px-3 py-2 text-right">{formatHours(e.hoursWorked)}</td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">
                      {e.hourlyRate ? `৳${e.hourlyRate}/hr` : e.monthlySalary ? `৳${e.monthlySalary}/mo` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{formatCurrency(e.estimatedCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Overtime Report */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Clock size={15} /> Overtime Report
        </h3>
        <div className="flex items-center gap-2 mb-4">
          <Input type="date" value={otFrom} onChange={e => setOtFrom(e.target.value)} className="h-8 text-sm w-36" />
          <span className="text-xs text-gray-400">to</span>
          <Input type="date" value={otTo} onChange={e => setOtTo(e.target.value)} className="h-8 text-sm w-36" />
          <Button size="sm" onClick={() => setOtEnabled(true)} disabled={loadingOt}>
            {loadingOt ? 'Loading…' : 'Run Report'}
          </Button>
        </div>
        {overtimeReport && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-y">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Employee</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Total Hours</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Regular</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Overtime</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {overtimeReport.map(e => (
                <tr key={e.userId} className={e.overtimeHours > 0 ? 'bg-yellow-50/40' : ''}>
                  <td className="px-3 py-2 font-medium">{e.name}</td>
                  <td className="px-3 py-2 text-right">{formatHours(e.totalHours)}</td>
                  <td className="px-3 py-2 text-right">{formatHours(e.totalHours - e.overtimeHours)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${e.overtimeHours > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                    {e.overtimeHours > 0 ? `+${formatHours(e.overtimeHours)}` : '—'}
                  </td>
                </tr>
              ))}
              {overtimeReport.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400 text-sm italic">No data</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Attendance Summary */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Calendar size={15} /> Attendance Summary
        </h3>
        <div className="flex items-center gap-2 mb-4">
          <Input type="date" value={attendFrom} onChange={e => setAttendFrom(e.target.value)} className="h-8 text-sm w-36" />
          <span className="text-xs text-gray-400">to</span>
          <Input type="date" value={attendTo} onChange={e => setAttendTo(e.target.value)} className="h-8 text-sm w-36" />
          <Button size="sm" onClick={() => setAttendEnabled(true)} disabled={loadingAttend}>
            {loadingAttend ? 'Loading…' : 'Run Report'}
          </Button>
        </div>
        {attendReport && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-y">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Employee</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Scheduled</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Worked</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Hours</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Late</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600">Absent</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {attendReport.map(e => (
                <tr key={e.userId}>
                  <td className="px-3 py-2 font-medium">{e.name}</td>
                  <td className="px-3 py-2 text-right">{e.scheduledShifts}</td>
                  <td className="px-3 py-2 text-right">{e.daysWorked}</td>
                  <td className="px-3 py-2 text-right">{formatHours(e.totalHours)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${e.lateArrivals > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                    {e.lateArrivals > 0 ? e.lateArrivals : '—'}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${e.absences > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {e.absences > 0 ? e.absences : '—'}
                  </td>
                </tr>
              ))}
              {attendReport.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400 text-sm italic">No data</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
  { key: 'employees', label: 'Employees', icon: Users },
  { key: 'schedule',  label: 'Schedule',  icon: Calendar },
  { key: 'time',      label: 'Time',      icon: Clock },
  { key: 'tips',      label: 'Tips',      icon: DollarSign },
  { key: 'leave',     label: 'Leave',     icon: CalendarOff },
  { key: 'reports',   label: 'Reports',   icon: BarChart3 },
]

export default function StaffPage() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''
  const [activeTab, setActiveTab] = useState<Tab>('employees')

  const isManager = ['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(user?.role ?? '')

  return (
    <PageShell title="Staff & HR" fullWidth>
      {/* Tab bar */}
      <div className="flex border-b border-border mb-6 -mt-2">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.key
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'employees' && <EmployeesTab restaurantId={restaurantId} />}
      {activeTab === 'schedule'  && <ScheduleTab restaurantId={restaurantId} />}
      {activeTab === 'time'      && <TimeTab restaurantId={restaurantId} currentUserId={user?.id ?? ''} />}
      {activeTab === 'tips'      && <TipsTab restaurantId={restaurantId} />}
      {activeTab === 'leave'     && <LeaveTab restaurantId={restaurantId} currentUserId={user?.id ?? ''} isManager={isManager} />}
      {activeTab === 'reports'   && <ReportsTab restaurantId={restaurantId} />}
    </PageShell>
  )
}
