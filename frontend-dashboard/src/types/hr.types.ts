export type ShiftStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'CANCELLED'
export type LeaveType = 'SICK' | 'CASUAL' | 'ANNUAL' | 'UNPAID' | 'OTHER'
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR'

export interface Employee {
  id: string
  tenantId: string
  restaurantId?: string | null
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  role: string
  isActive: boolean
  lastLoginAt?: string | null
  createdAt: string
  // HR fields
  hireDate?: string | null
  employmentType?: EmploymentType | null
  hourlyRate?: number | null
  monthlySalary?: number | null
  emergencyContact?: string | null
  emergencyPhone?: string | null
  bankAccount?: string | null
  hrNotes?: string | null
}

export interface Shift {
  id: string
  userId: string
  role: string
  startsAt: string
  endsAt: string
  status: ShiftStatus
  notes?: string | null
  createdBy: string
  createdAt: string
  user: { id: string; firstName: string; lastName: string; role: string }
}

export interface TimeEntry {
  id: string
  userId: string
  clockIn: string
  clockOut?: string | null
  shiftId?: string | null
  hoursWorked?: number | null
  isManual: boolean
  notes?: string | null
  createdAt: string
  user: { id: string; firstName: string; lastName: string; role?: string }
}

export interface ClockStatus {
  isClockedIn: boolean
  entry: TimeEntry | null
}

export interface TipRecord {
  id: string
  userId: string
  amount: number
  source: string
  orderId?: string | null
  date: string
  notes?: string | null
  createdAt: string
  user: { id: string; firstName: string; lastName: string }
}

export interface TipSummary {
  userId: string
  name: string
  total: number
}

export interface LeaveRequest {
  id: string
  userId: string
  type: LeaveType
  status: LeaveStatus
  startDate: string
  endDate: string
  days: number
  reason?: string | null
  managerNote?: string | null
  reviewedBy?: string | null
  reviewedAt?: string | null
  createdAt: string
  user: { id: string; firstName: string; lastName: string }
}

export interface AttendanceSummary {
  userId: string
  name: string
  role: string
  scheduledShifts: number
  daysWorked: number
  totalHours: number
  lateArrivals: number
  absences: number
}

export interface OvertimeReport {
  userId: string
  name: string
  role: string
  totalHours: number
  overtimeHours: number
  weeks: {
    weekStart: string
    regularHours: number
    overtimeHours: number
    days: { date: string; hours: number; ot: number }[]
  }[]
}

export interface LaborCostReport {
  dateFrom: string
  dateTo: string
  totalRevenue: number
  totalLaborCost: number
  laborCostPct: number
  byEmployee: {
    userId: string
    name: string
    role: string
    hoursWorked: number
    hourlyRate: number | null
    monthlySalary: number | null
    estimatedCost: number
  }[]
}
