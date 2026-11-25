export type Meridiem = 'am' | 'pm'

/** 화면용 12시간. 저장값은 항상 24시간 `HH:mm`. */
export type ClockParts = {
  hour12: number
  minute: number
  meridiem: Meridiem
}

const HM24 = /^(\d{1,2}):(\d{2})$/

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function digitsOnly(raw: string, maxLength: number): string {
  return raw.replace(/\D/g, '').slice(0, maxLength)
}

export function clampHour12(value: number): number {
  if (!Number.isFinite(value)) return 12
  const hour = Math.trunc(value)
  if (hour < 1) return 1
  if (hour > 12) return 12
  return hour
}

export function clampMinute(value: number): number {
  if (!Number.isFinite(value)) return 0
  const minute = Math.trunc(value)
  if (minute < 0) return 0
  if (minute > 59) return 59
  return minute
}

export function parseHm24(value: string | null | undefined): ClockParts | null {
  const match = HM24.exec(String(value ?? '').trim())
  if (!match) return null
  const hour24 = Number(match[1])
  const minute = Number(match[2])
  if (hour24 > 23 || minute > 59) return null
  return {
    hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute,
    meridiem: hour24 >= 12 ? 'pm' : 'am',
  }
}

export function toHm24(parts: ClockParts): string {
  const hour12 = clampHour12(parts.hour12)
  const minute = clampMinute(parts.minute)
  const hour24 = parts.meridiem === 'pm' ? (hour12 % 12) + 12 : hour12 % 12
  return `${pad2(hour24)}:${pad2(minute)}`
}

export function formatKoreanClock(value: string | null | undefined): string {
  const parts = parseHm24(value)
  if (!parts) return ''
  const meridiem = parts.meridiem === 'am' ? '오전' : '오후'
  return `${meridiem} ${parts.hour12}:${pad2(parts.minute)}`
}

/** 비어 있으면 null. 범위 밖 숫자도 그대로 반환해 포커스 이탈 때 보정한다. */
export function readDraftNumber(raw: string): number | null {
  const digits = digitsOnly(raw, 2)
  if (!digits) return null
  return Number(digits)
}

export function shiftHour12(hour12: number, delta: number): number {
  return ((clampHour12(hour12) - 1 + delta) % 12 + 12) % 12 + 1
}

export function shiftMinute(minute: number, delta: number): number {
  return (clampMinute(minute) + delta + 60) % 60
}

/** PC에서 입력칸 너비만큼 늘어나지 않는 시간 패널. 뷰포트보다 넓어지지 않는다. */
export const TIME_POPOVER_PREFERRED_WIDTH = 328

export function placeTimePopover(
  rect: { left: number; width: number; bottom: number },
  viewportWidth: number,
  margin = 8,
): { top: number; left: number; width: number } {
  const width = Math.min(TIME_POPOVER_PREFERRED_WIDTH, Math.max(0, viewportWidth - margin * 2))
  const center = rect.left + rect.width / 2
  const left = Math.max(margin, Math.min(center - width / 2, viewportWidth - width - margin))
  return { top: rect.bottom + 4, left, width }
}
