/** 저장 본문: 선택적 첫 줄 YYYY-MM-DD + 개행 + 내용 (DB 변경 없이 상담 일자 표현) */
const DATE_FIRST_LINE = /^(\d{4}-\d{2}-\d{2})\n([\s\S]*)$/

export function parseConsultationStoredBody(
  raw: string,
  createdAtIso: string,
): { dateLabel: string; text: string } {
  const s = String(raw ?? '')
  const m = s.match(DATE_FIRST_LINE)
  if (m) {
    return { dateLabel: m[1], text: m[2].trim() }
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
