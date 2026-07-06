import { formatTaDayHeaderCompact } from './taCallDisplay'
import type { TaCallDay } from '../types/taCall.types'

export type TaWeekSummaryDayLabel = '일' | '월' | '화' | '수' | '목' | '금' | '토'

export type TaWeekSummaryRowStatus = 'completed' | 'today' | 'scheduled' | 'empty' | 'in_progress'

export type TaWeekSummaryItem = {
  date: string
  dayLabel: TaWeekSummaryDayLabel
  displayDate: string
  completedCount: number
  targetCount: number
  hasAssignment: boolean
  isToday: boolean
  isFuture: boolean
  status: TaWeekSummaryRowStatus
  progressPercent: number
}

const DAY_LABELS: TaWeekSummaryDayLabel[] = ['일', '월', '화', '수', '목', '금', '토']

function toDayLabel(weekday: string): TaWeekSummaryDayLabel {
  if (DAY_LABELS.includes(weekday as TaWeekSummaryDayLabel)) {
    return weekday as TaWeekSummaryDayLabel
  }
  return '월'
}

export function resolveTaWeekSummaryStatus(day: TaCallDay): TaWeekSummaryRowStatus {
  if (day.isFuture) {
    return 'scheduled'
  }
  if (day.totalCount === 0) {
    return 'empty'
  }
  if (day.isToday) {
    return 'today'
  }
  if (day.isMissionCompleted || day.completedCount >= day.dailyTargetCount) {
    return 'completed'
  }
  return 'in_progress'
}

export function resolveTaWeekSummaryProgressPercent(day: TaCallDay): number {
  const targetCount = day.dailyTargetCount
  if (targetCount <= 0) {
    return 0
  }
  return Math.min(100, Math.round((day.completedCount / targetCount) * 100))
}

export function buildTaWeekSummaryItems(days: TaCallDay[]): TaWeekSummaryItem[] {
  return days.map((day) => {
    const { dateLabel, weekday } = formatTaDayHeaderCompact(day.date)
    const status = resolveTaWeekSummaryStatus(day)
    return {
      date: day.date,
      dayLabel: toDayLabel(weekday),
      displayDate: dateLabel,
      completedCount: day.completedCount,
      targetCount: day.dailyTargetCount,
      hasAssignment: day.totalCount > 0,
      isToday: day.isToday,
      isFuture: day.isFuture,
      status,
      progressPercent: resolveTaWeekSummaryProgressPercent(day),
    }
  })
}

export function formatTaWeekRangeCompactLabel(start: string, end: string): string {
  const formatPart = (value: string) => {
    if (value.length < 10) {
      return value.replace(/-/g, '.')
    }
    return `${value.slice(5, 7)}.${value.slice(8, 10)}`
  }
  return `${formatPart(start)} ~ ${formatPart(end)}`
}
