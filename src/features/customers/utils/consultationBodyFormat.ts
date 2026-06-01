import {
  normalizeConsultationDateForInput,
  normalizeDateForDateInput,
} from '../../../../server/lib/consultationDateFormat.js'

export { normalizeConsultationDateForInput, normalizeDateForDateInput }

function formatCreatedAtLocalYmd(createdAtIso: string): string {
  const d = new Date(createdAtIso)
  if (Number.isNaN(d.getTime())) {
    const fromIso = normalizeConsultationDateForInput(createdAtIso)
    return fromIso || String(createdAtIso ?? '').slice(0, 10)
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseConsultationStoredBody(
  raw: string,
  createdAtIso: string,
  consultationDate?: string | null,
): { dateLabel: string; text: string } {
  const s = String(raw ?? '')
  const fromColumn = normalizeConsultationDateForInput(consultationDate)
  if (fromColumn) {
    return { dateLabel: fromColumn, text: s.trim() }
  }
  return { dateLabel: formatCreatedAtLocalYmd(createdAtIso), text: s.trim() }
}

export function localYmd(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 상담 추가: 비어 있으면 오늘. 상담 수정: 비어 있으면 originalDate 유지. */
export function resolveConsultationDateForSave(
  formDate: string,
  originalDate: string,
  mode: 'create' | 'edit',
): string | null {
  const fromForm = normalizeConsultationDateForInput(formDate)
  if (mode === 'edit') {
    const fromOriginal = normalizeConsultationDateForInput(originalDate)
    return fromForm || fromOriginal || null
  }
  return fromForm || localYmd()
}

/** 수정 모달 open 시 기존 상담일 (오늘/localNow 폴백 없음) */
export function resolveConsultationDateForEditForm(
  consultationDate: string | null | undefined,
  dateLabelFromRow: string,
): string {
  return (
    normalizeConsultationDateForInput(consultationDate) ||
    normalizeConsultationDateForInput(dateLabelFromRow) ||
    ''
  )
}
