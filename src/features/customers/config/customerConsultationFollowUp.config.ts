/** 상담 통화 결과 — UI/API 공통 옵션 (후속관리 DB 컬럼은 서버 하위호환용으로 유지) */

export const CONTACT_RESULT_OPTIONS = [
  '통화완료',
  '부재중',
  '문자발송',
  '재통화요청',
  '관심있음',
  '거절',
  '계약진행',
  '보류',
  '기타',
] as const

export const CONTACT_RESULT_FORM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '미지정' },
  ...CONTACT_RESULT_OPTIONS.map((v) => ({ value: v, label: v })),
]

export function normalizeContactResult(value: string | null | undefined): string {
  const s = String(value ?? '').trim()
  if (!s || s === '미지정') {
    return ''
  }
  return CONTACT_RESULT_OPTIONS.includes(s as (typeof CONTACT_RESULT_OPTIONS)[number]) ? s : ''
}

export function formatContactResultMetaLabel(row: { contactResult?: string | null }): string {
  const contact = normalizeContactResult(row.contactResult)
  return contact ? `통화: ${contact}` : ''
}

/** @deprecated UI에서 후속관리 표시 제거 — formatContactResultMetaLabel 사용 */
export function formatFollowUpMetaLabel(row: { contactResult?: string | null }): string {
  return formatContactResultMetaLabel(row)
}
