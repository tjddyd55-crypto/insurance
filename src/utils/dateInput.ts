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
