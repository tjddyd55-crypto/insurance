/** 상담 후속관리 — UI/API 공통 옵션 */

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

export const FOLLOW_UP_STATUS_OPTIONS = ['후속필요', '예정됨', '완료', '보류', '종료'] as const

export type FollowUpFilterValue =
  | ''
  | 'today'
  | 'overdue'
  | 'scheduled'
  | 'needed'
  | 'open'
  | 'none'

export const FOLLOW_UP_FILTER_OPTIONS: Array<{ value: FollowUpFilterValue; label: string }> = [
  { value: '', label: '전체' },
  { value: 'today', label: '오늘 연락 예정' },
  { value: 'overdue', label: '기한 지난 연락' },
  { value: 'scheduled', label: '예정 있음' },
  { value: 'needed', label: '후속 필요' },
  { value: 'open', label: '완료/종료 제외' },
  { value: 'none', label: '후속 없음' },
]

export const CONTACT_RESULT_FORM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '미지정' },
  ...CONTACT_RESULT_OPTIONS.map((v) => ({ value: v, label: v })),
]

export const FOLLOW_UP_STATUS_FORM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '미지정' },
  ...FOLLOW_UP_STATUS_OPTIONS.map((v) => ({ value: v, label: v })),
]

export type CustomerFollowUpSortValue =
  | 'nextContactAsc'
  | 'nextContactDesc'
  | 'overdueFollowUpFirst'

export const CUSTOMER_FOLLOW_UP_SORT_OPTIONS: Array<{ value: CustomerFollowUpSortValue; label: string }> = [
  { value: 'nextContactAsc', label: '다음 연락 예정일 빠른순' },
  { value: 'nextContactDesc', label: '다음 연락 예정일 늦은순' },
  { value: 'overdueFollowUpFirst', label: '기한 지난 후속 우선' },
]

export function normalizeContactResult(value: string | null | undefined): string {
  const s = String(value ?? '').trim()
  if (!s || s === '미지정') {
    return ''
  }
  return CONTACT_RESULT_OPTIONS.includes(s as (typeof CONTACT_RESULT_OPTIONS)[number]) ? s : ''
}

export function normalizeFollowUpStatus(value: string | null | undefined): string {
  const s = String(value ?? '').trim()
  if (!s || s === '미지정') {
    return ''
  }
  return FOLLOW_UP_STATUS_OPTIONS.includes(s as (typeof FOLLOW_UP_STATUS_OPTIONS)[number]) ? s : ''
}

export function formatFollowUpMetaLabel(row: {
  contactResult?: string | null
  followUpStatus?: string | null
  nextContactDate?: string | null
  followUpNote?: string | null
}): string {
  const parts: string[] = []
  const contact = normalizeContactResult(row.contactResult)
  if (contact) {
    parts.push(`통화: ${contact}`)
  }
  const status = normalizeFollowUpStatus(row.followUpStatus)
  if (status) {
    parts.push(`후속: ${status}`)
  }
  if (row.nextContactDate?.trim()) {
    parts.push(`다음 연락: ${row.nextContactDate.trim()}`)
  }
  const note = String(row.followUpNote ?? '').trim()
  if (note) {
    parts.push(note.length > 60 ? `${note.slice(0, 60)}…` : note)
  }
  return parts.join(' · ')
}
