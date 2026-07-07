import { SMS_SCHEDULE_WEEKDAY_OPTIONS } from '../config/smsScheduled.config'
import type { SmsScheduledFormState, SmsScheduledRule } from '../types/smsScheduled.types'

function weekdayLabel(value: number): string {
  return SMS_SCHEDULE_WEEKDAY_OPTIONS.find((d) => d.value === value)?.label ?? String(value)
}

export function formatScheduleTimeLabel(sendTime: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(sendTime.trim())
  if (!match) {
    return sendTime
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return sendTime
  }
  const period = hour < 12 ? '오전' : '오후'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return minute === 0 ? `${period} ${hour12}:00` : `${period} ${hour12}:${String(minute).padStart(2, '0')}`
}

export function formatScheduleDateLabel(sendDate: string): string {
  if (!sendDate) {
    return ''
  }
  const date = new Date(`${sendDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return sendDate
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatScheduleWeekdaysLabel(weekdays: number[] | undefined): string {
  if (!weekdays?.length) {
    return ''
  }
  return weekdays
    .slice()
    .sort((a, b) => a - b)
    .map(weekdayLabel)
    .join('/')
}

export function buildScheduleSummary(
  input: Pick<
    SmsScheduledRule | SmsScheduledFormState,
    'scheduleType' | 'sendDate' | 'sendTime' | 'weekdays' | 'monthDay'
  >,
): string {
  const timeLabel = formatScheduleTimeLabel(input.sendTime)
  switch (input.scheduleType) {
    case 'once': {
      const dateLabel = formatScheduleDateLabel(input.sendDate ?? '')
      return dateLabel ? `${dateLabel} ${timeLabel} 발송` : `${timeLabel} 발송`
    }
    case 'daily':
      return `매일 ${timeLabel} 발송`
    case 'weekly': {
      const days = formatScheduleWeekdaysLabel(input.weekdays)
      return days ? `매주 ${days} ${timeLabel} 발송` : `매주 ${timeLabel} 발송`
    }
    case 'monthly':
      return `매월 ${input.monthDay ?? 1}일 ${timeLabel} 발송`
    default:
      return timeLabel
  }
}

export function buildScheduleListCardMeta(rule: SmsScheduledRule): string {
  const enabledLabel = rule.enabled && rule.status === 'active' ? '활성' : '비활성'
  return `${enabledLabel} · ${buildScheduleSummary(rule)}`
}

export function computeNextRunAtPreview(
  input: Pick<
    SmsScheduledFormState,
    'scheduleType' | 'sendDate' | 'sendTime' | 'weekdays' | 'monthDay' | 'enabled'
  >,
): string | null {
  if (!input.enabled || !input.sendTime) {
    return null
  }
  const [hourText, minuteText] = input.sendTime.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null
  }

  const now = new Date()

  if (input.scheduleType === 'once') {
    if (!input.sendDate) {
      return null
    }
    const candidate = new Date(`${input.sendDate}T${input.sendTime}:00`)
    return Number.isNaN(candidate.getTime()) || candidate.getTime() <= now.getTime() ? null : candidate.toISOString()
  }

  if (input.scheduleType === 'daily') {
    const candidate = new Date(now)
    candidate.setHours(hour, minute, 0, 0)
    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 1)
    }
    return candidate.toISOString()
  }

  if (input.scheduleType === 'weekly') {
    if (!input.weekdays?.length) {
      return null
    }
    const jsWeekday = now.getDay() === 0 ? 7 : now.getDay()
    const sorted = [...input.weekdays].sort((a, b) => a - b)
    for (let offset = 0; offset <= 7; offset += 1) {
      const day = ((jsWeekday - 1 + offset) % 7) + 1
      if (!sorted.includes(day)) {
        continue
      }
      const candidate = new Date(now)
      candidate.setDate(candidate.getDate() + offset)
      candidate.setHours(hour, minute, 0, 0)
      if (candidate.getTime() > now.getTime()) {
        return candidate.toISOString()
      }
    }
    return null
  }

  if (input.scheduleType === 'monthly') {
    const day = input.monthDay ?? 1
    const candidate = new Date(now.getFullYear(), now.getMonth(), day, hour, minute, 0, 0)
    if (candidate.getDate() !== day) {
      candidate.setDate(0)
      candidate.setHours(hour, minute, 0, 0)
    }
    if (candidate.getTime() <= now.getTime()) {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, day, hour, minute, 0, 0)
      if (nextMonth.getDate() !== day) {
        nextMonth.setDate(0)
        nextMonth.setHours(hour, minute, 0, 0)
      }
      return nextMonth.toISOString()
    }
    return candidate.toISOString()
  }

  return null
}

export function formatNextRunAtLabel(iso: string | null | undefined): string {
  if (!iso) {
    return '다음 실행 예정 없음'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '다음 실행 예정 없음'
  }
  return date.toLocaleString('ko-KR', { hour12: false })
}
