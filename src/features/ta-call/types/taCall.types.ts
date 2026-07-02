export type TaCallStatus = 'not_called' | 'completed' | 'no_answer'

export type TaTargetGender = 'all' | 'male' | 'female'

export type TaCallAssignment = {
  id: string
  customerId: string
  customerName: string
  customerPhone: string
  customerBirthDate: string | null
  customerGender: string
  status: TaCallStatus
}

export type TaCallDay = {
  date: string
  dailyTargetCount: number
  totalCount: number
  completedCount: number
  noAnswerCount: number
  notCalledCount: number
  isToday: boolean
  isFuture: boolean
  isMissionCompleted: boolean
  assignments: TaCallAssignment[]
  emptyMessage?: string | null
  emptySubMessage?: string | null
}

export type TaCallWeekPayload = {
  weekStartDate: string
  weekEndDate: string
  dailyTargetCount: number
  targetFilterSummary?: string
  days: TaCallDay[]
}

export type TaCallSettings = {
  dailyTargetCount: number
  targetGender: TaTargetGender
  targetSangnyeongDays: number | null
  targetInsuranceAgeMin: number | null
  targetInsuranceAgeMax: number | null
  excludeMinors: boolean
  updatedAt: string | null
}

export const TA_STATUS_LABELS: Record<TaCallStatus, string> = {
  not_called: '미통화',
  completed: '통화완료',
  no_answer: '부재중',
}

function parseOptionalInt(raw: unknown): number | null {
  if (raw == null || raw === '') {
    return null
  }
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function parseTargetGender(raw: unknown): TaTargetGender {
  const value = String(raw ?? 'all')
  if (value === 'male' || value === 'female') {
    return value
  }
  return 'all'
}

export function normalizeTaCallWeekPayload(raw: unknown): TaCallWeekPayload {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const daysRaw = Array.isArray(obj.days) ? obj.days : []
  return {
    weekStartDate: String(obj.weekStartDate ?? ''),
    weekEndDate: String(obj.weekEndDate ?? ''),
    dailyTargetCount: Number(obj.dailyTargetCount ?? 10) || 10,
    targetFilterSummary: obj.targetFilterSummary ? String(obj.targetFilterSummary) : undefined,
    days: daysRaw.map(normalizeTaCallDay),
  }
}

export function normalizeTaCallDay(raw: unknown): TaCallDay {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const assignmentsRaw = Array.isArray(obj.assignments) ? obj.assignments : []
  return {
    date: String(obj.date ?? ''),
    dailyTargetCount: Number(obj.dailyTargetCount ?? 10) || 10,
    totalCount: Number(obj.totalCount ?? 0) || 0,
    completedCount: Number(obj.completedCount ?? 0) || 0,
    noAnswerCount: Number(obj.noAnswerCount ?? 0) || 0,
    notCalledCount: Number(obj.notCalledCount ?? 0) || 0,
    isToday: Boolean(obj.isToday),
    isFuture: Boolean(obj.isFuture),
    isMissionCompleted: Boolean(obj.isMissionCompleted),
    assignments: assignmentsRaw.map(normalizeTaCallAssignment),
    emptyMessage: obj.emptyMessage ? String(obj.emptyMessage) : null,
    emptySubMessage: obj.emptySubMessage ? String(obj.emptySubMessage) : null,
  }
}

export function normalizeTaCallAssignment(raw: unknown): TaCallAssignment {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const statusRaw = String(obj.status ?? 'not_called')
  const status: TaCallStatus =
    statusRaw === 'completed' || statusRaw === 'no_answer' ? statusRaw : 'not_called'
  return {
    id: String(obj.id ?? ''),
    customerId: String(obj.customerId ?? ''),
    customerName: String(obj.customerName ?? ''),
    customerPhone: String(obj.customerPhone ?? ''),
    customerBirthDate: obj.customerBirthDate ? String(obj.customerBirthDate) : null,
    customerGender: String(obj.customerGender ?? ''),
    status,
  }
}

export function normalizeTaCallSettings(raw: unknown): TaCallSettings {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    dailyTargetCount: Number(obj.dailyTargetCount ?? 10) || 10,
    targetGender: parseTargetGender(obj.targetGender),
    targetSangnyeongDays: parseOptionalInt(obj.targetSangnyeongDays),
    targetInsuranceAgeMin: parseOptionalInt(obj.targetInsuranceAgeMin),
    targetInsuranceAgeMax: parseOptionalInt(obj.targetInsuranceAgeMax),
    excludeMinors: obj.excludeMinors !== false,
    updatedAt: obj.updatedAt ? String(obj.updatedAt) : null,
  }
}
