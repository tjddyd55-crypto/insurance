function normalizeYmd(value: unknown): string | null {
  const s = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return null
  }
  return s
}

/**
 * `input[type="date"]` 전용 YYYY-MM-DD 정규화.
 * - 이미 YYYY-MM-DD면 그대로 사용
 * - ISO datetime 등은 앞 10글자(YYYY-MM-DD)만 사용 가능할 때만 사용
 * - 그 외는 Date 파싱이 가능하면 toISOString().slice(0, 10)
 */
export function normalizeDateForDateInput(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const direct = normalizeYmd(raw)
  if (direct) return direct

  const head = raw.slice(0, 10)
  const headYmd = normalizeYmd(head)
  if (headYmd) return headYmd

  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10)
  }

  return null
}

export function parseConsultationStoredBody(
  raw: string,
  createdAtIso: string,
  consultationDate?: string | null,
): { dateLabel: string; text: string } {
  const s = String(raw ?? '')
  const fromColumn = normalizeYmd(consultationDate)
  if (fromColumn) {
    return { dateLabel: fromColumn, text: s.trim() }
  }
  const d = new Date(createdAtIso)
  const label = Number.isNaN(d.getTime())
    ? String(createdAtIso ?? '').slice(0, 10)
    : d.toISOString().slice(0, 10)
  return { dateLabel: label, text: s.trim() }
}

export function localYmd(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
