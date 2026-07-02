import { addDaysToDateOnly, formatKoreanDateOnlyWithWeekday } from '../../../../shared/dateTimeKst'
import {
  buildTaCallTelHref,
  formatTaCallBirthDate,
  formatTaCallGender,
  formatTaCallPhoneNumber,
} from '../../../../shared/taCallDisplayFormat.js'
import type { TaCallDay, TaCallWeekPayload } from '../types/taCall.types'

export {
  buildTaCallTelHref,
  formatTaCallBirthDate,
  formatTaCallGender,
  formatTaCallPhoneNumber,
}

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

/** 예: 6/29, 월 */
export function formatTaDayHeaderCompact(date: string): { dateLabel: string; weekday: string } {
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const weekday = formatTaDayHeader(date).weekday
  return { dateLabel: `${month}/${day}`, weekday }
}

export function buildTelHref(phone: string): string {
  return buildTaCallTelHref(phone)
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
  if (day.emptyMessage) {
    return day.emptyMessage
  }
  if (day.isToday) {
    return '현재 설정한 조건에 맞는 전화 대상 고객이 없습니다.'
  }
  return '배정 없음'
}

export function resolveDayEmptySubMessage(day: TaCallDay): string | null {
  if (day.totalCount > 0 || day.isFuture) {
    return null
  }
  return day.emptySubMessage ?? '타겟 조건을 변경하거나 고객 정보를 확인해 주세요.'
}

export function resolveDayStatusBadge(day: TaCallDay): string {
  if (day.isFuture) return '예정'
  if (day.totalCount === 0) return '배정 없음'
  if (day.isMissionCompleted) return '미션 완료'
  if (day.isToday) return '오늘 진행 중'
  if (day.completedCount < day.totalCount) return '미완료'
  return '미션 완료'
}

export function resolveDayHeaderRatio(day: TaCallDay): string {
  if (day.isFuture) return '예정'
  const total = day.totalCount > 0 ? day.totalCount : day.dailyTargetCount
  return `${day.completedCount}/${total}`
}

export {
  buildDefaultExpandedDates,
  isDayExpanded,
  toggleExpandedDate,
} from '../../../../shared/taCallDayExpand.js'
