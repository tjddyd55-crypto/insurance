/** 숫자만 추출해 최대 8자리 → YYYY / YYYY-MM / YYYY-MM-DD */
export function normalizeDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  const year = digits.slice(0, 4)
  const month = digits.slice(4, 6)
  const day = digits.slice(6, 8)

  if (digits.length <= 4) {
    return year
  }
  if (digits.length <= 6) {
    return `${year}-${month}`
  }
  return `${year}-${month}-${day}`
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** 저장/API용 — 완전한 YYYY-MM-DD만 반환, 아니면 빈 문자열 */
export function coerceStoredDateValue(raw: string | null | undefined): string {
  const normalized = normalizeDateInput(String(raw ?? '').trim())
  return isValidDateString(normalized) ? normalized : ''
}

export function dateToYmd(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function ymdToDate(value: string): Date | null {
  const stored = coerceStoredDateValue(value)
  if (!stored) {
    return null
  }
  const [year, month, day] = stored.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Asia/Seoul 기준 오늘 YYYY-MM-DD */
export function todayInSeoul(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** UTC calendar day 기준 일수 차이 (target - base) */
export function diffCalendarDaysYmd(targetYmd: string, baseYmd: string): number | null {
  const target = coerceStoredDateValue(targetYmd)
  const base = coerceStoredDateValue(baseYmd)
  if (!target || !base) {
    return null
  }
  const utcDay = (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((utcDay(target) - utcDay(base)) / 86_400_000)
}

export function addYearsToYmd(ymd: string, years: number): string | null {
  const parsed = ymdToDate(ymd)
  if (!parsed) {
    return null
  }
  const next = new Date(parsed.getFullYear() + years, parsed.getMonth(), parsed.getDate())
  return dateToYmd(next)
}
