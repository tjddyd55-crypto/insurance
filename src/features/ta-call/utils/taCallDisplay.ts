import { addDaysToDateOnly, formatKoreanDateOnlyWithWeekday } from '../../../../shared/dateTimeKst'
import type { TaCallDay, TaCallWeekPayload } from '../types/taCall.types'

export function formatTaWeekRangeLabel(start: string, end: string): string {
  const startLabel = start.replace(/-/g, '.')
  const endLabel = end.length >= 10 ? end.slice(5).replace(/-/g, '.') : end.replace(/-/g, '.')
  return `${startLabel} ~ ${endLabel}`
}

export function formatTaDayHeader(date: string): { weekday: string; dayNum: string; full: string } {
  const full = formatKoreanDateOnlyWithWeekday(date, { compact: false })
  const dayNum = date.length >= 10 ? String(Number(date.slice(8, 10))) : ''
  const weekdayMatch = full.match(/\((.)\)/)
  const weekday = weekdayMatch?.[1] ?? ''
  return { weekday, dayNum, full }
}

export function formatTaBirthDateDots(value: string | null | undefined): string {
  if (!value) return '—'
  return value.replace(/-/g, '.')
}

export function buildTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits ? `tel:${digits}` : ''
}

export function findTodayDay(week: TaCallWeekPayload | null): TaCallDay | null {
  if (!week) return null
  return week.days.find((day) => day.isToday) ?? null
}

export function shiftWeekStartDate(currentStart: string, deltaWeeks: number): string {
  return addDaysToDateOnly(currentStart, deltaWeeks * 7)
}

export function resolveDayEmptyMessage(day: TaCallDay): string | null {
  if (day.isFuture) {
    return '해당 날짜가 되면 자동으로 전화 대상이 생성됩니다.'
  }
  if (day.totalCount > 0) {
    return null
  }
  if (day.isToday) {
    return '오늘 배정 가능한 성인 고객이 없습니다.'
  }
  return '배정 없음'
}

export function resolveDayStatusBadge(day: TaCallDay): string {
  if (day.isFuture) return '예정'
  if (day.totalCount === 0) return '배정 없음'
  if (day.isMissionCompleted) return '미션 완료'
  if (day.isToday) return '오늘 진행 중'
  if (day.completedCount < day.totalCount) return '미완료'
  return '미션 완료'
}

export function genderSymbol(gender: string): string {
  const g = gender.trim().toUpperCase()
  if (g === 'M' || g === '남' || g === 'MALE') return 'M'
  if (g === 'F' || g === '여' || g === 'FEMALE') return 'F'
  return ''
}
