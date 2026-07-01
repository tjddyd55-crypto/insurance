export type TaCallStatus = 'not_called' | 'completed' | 'no_answer'

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
}

export type TaCallWeekPayload = {
  weekStartDate: string
  weekEndDate: string
  dailyTargetCount: number
  days: TaCallDay[]
}

export type TaCallSettings = {
  dailyTargetCount: number
  updatedAt: string | null
}

export const TA_STATUS_LABELS: Record<TaCallStatus, string> = {
  not_called: '미통화',
  completed: '통화완료',
  no_answer: '부재중',
}

export function normalizeTaCallWeekPayload(raw: unknown): TaCallWeekPayload {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const daysRaw = Array.isArray(obj.days) ? obj.days : []
  return {
    weekStartDate: String(obj.weekStartDate ?? ''),
    weekEndDate: String(obj.weekEndDate ?? ''),
    dailyTargetCount: Number(obj.dailyTargetCount ?? 10) || 10,
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
    updatedAt: obj.updatedAt ? String(obj.updatedAt) : null,
  }
}
