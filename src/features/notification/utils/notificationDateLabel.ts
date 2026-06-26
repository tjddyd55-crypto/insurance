import {
  diffDateOnlyDays,
  formatDateOnly,
  formatKstDate,
  getKstDateString,
} from '../../../utils/displayDateTime'
import type { NotificationRow } from '../api/notificationApi'

/** 알림 목록 기준일 컬럼 — YYYY-MM-DD (D-n) / (D-Day) / (D+n) */
export function formatNotificationTargetDateWithDDay(
  targetDate?: string | null,
  today: string = getKstDateString(),
): string {
  const dateOnly = formatDateOnly(targetDate ?? '')
  if (!dateOnly) {
    return '—'
  }
  return `${dateOnly} (${formatNotificationDDayLabel(dateOnly, today)})`
}

export function resolveNotificationReferenceDate(row: {
  targetDate?: string | null
  createdAt?: string | null
  type?: string
}): string {
  const target = formatDateOnly(row.targetDate ?? '')
  if (target) {
    return target
  }
  if (row.type === 'claim_request_received' && row.createdAt) {
    return formatKstDate(row.createdAt)
  }
  return ''
}

export function formatNotificationDateOnly(row: NotificationRow): string {
  return resolveNotificationReferenceDate(row) || '—'
}

export function formatNotificationDDayLabel(
  referenceDate?: string | null,
  today: string = getKstDateString(),
): string {
  const dateOnly = formatDateOnly(referenceDate ?? '')
  if (!dateOnly) {
    return '—'
  }
  const diffDays = diffDateOnlyDays(dateOnly, today)
  if (diffDays === null) {
    return '—'
  }
  if (diffDays === 0) {
    return 'D-Day'
  }
  if (diffDays > 0) {
    return `D-${diffDays}`
  }
  return `D+${Math.abs(diffDays)}`
}

export function formatNotificationRowDDay(row: NotificationRow, today: string = getKstDateString()): string {
  const referenceDate = resolveNotificationReferenceDate(row)
  if (!referenceDate) {
    return '—'
  }
  return formatNotificationDDayLabel(referenceDate, today)
}

export function sortNotificationRowsByReferenceDate<T extends NotificationRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const dateA = resolveNotificationReferenceDate(a)
    const dateB = resolveNotificationReferenceDate(b)
    if (dateA && dateB && dateA !== dateB) {
      return dateA.localeCompare(dateB)
    }
    if (dateA && !dateB) {
      return -1
    }
    if (!dateA && dateB) {
      return 1
    }
    return String(a.createdAt).localeCompare(String(b.createdAt))
  })
}
