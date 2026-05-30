/**
 * 상담 후속관리 — DB/API 공통 옵션·정규화.
 */

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
]

export const FOLLOW_UP_STATUS_OPTIONS = [
  '후속필요',
  '예정됨',
  '완료',
  '보류',
  '종료',
]

export const CLOSED_FOLLOW_UP_STATUSES = ['완료', '종료']

const FOLLOW_UP_NOTE_MAX = 2000

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: string | null } | { ok: false, message: string }}
 */
export function normalizeContactResultForDb(raw) {
  if (raw == null) {
    return { ok: true, value: null }
  }
  const s = String(raw).trim()
  if (!s || s === '미지정') {
    return { ok: true, value: null }
  }
  if (CONTACT_RESULT_OPTIONS.includes(s)) {
    return { ok: true, value: s }
  }
  return { ok: false, message: '잘못된 통화 결과입니다.' }
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: string | null } | { ok: false, message: string }}
 */
export function normalizeFollowUpStatusForDb(raw) {
  if (raw == null) {
    return { ok: true, value: null }
  }
  const s = String(raw).trim()
  if (!s || s === '미지정') {
    return { ok: true, value: null }
  }
  if (FOLLOW_UP_STATUS_OPTIONS.includes(s)) {
    return { ok: true, value: s }
  }
  return { ok: false, message: '잘못된 후속 상태입니다.' }
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: string | null } | { ok: false, message: string }}
 */
export function normalizeNextContactDateForDb(raw) {
  if (raw == null) {
    return { ok: true, value: null }
  }
  const s = String(raw).trim()
  if (!s) {
    return { ok: true, value: null }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { ok: false, message: '다음 연락 예정일은 YYYY-MM-DD 형식이어야 합니다.' }
  }
  return { ok: true, value: s }
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: string | null } | { ok: false, message: string }}
 */
export function normalizeFollowUpNoteForDb(raw) {
  if (raw == null) {
    return { ok: true, value: null }
  }
  const s = String(raw).trim()
  if (!s) {
    return { ok: true, value: null }
  }
  if (s.length > FOLLOW_UP_NOTE_MAX) {
    return { ok: false, message: `후속 메모는 ${FOLLOW_UP_NOTE_MAX}자 이하로 입력해 주세요.` }
  }
  return { ok: true, value: s }
}

/**
 * @param {string | null | undefined} status
 */
export function isClosedFollowUpStatus(status) {
  const s = String(status ?? '').trim()
  return CLOSED_FOLLOW_UP_STATUSES.includes(s)
}

/**
 * SQL fragment: alias is open (not 완료/종료).
 * @param {string} alias
 */
export function sqlFollowUpNotClosed(alias) {
  return `(${alias}.follow_up_status IS NULL OR ${alias}.follow_up_status NOT IN ('완료', '종료'))`
}

/**
 * @param {Record<string, unknown>} query
 * @returns {{ mode: string | null, error: string | null }}
 */
export function parseFollowUpFilterQuery(query) {
  const raw = query?.followUpFilter ?? query?.follow_up_filter
  if (raw == null || String(raw).trim() === '' || String(raw).trim().toLowerCase() === 'all') {
    return { mode: null, error: null }
  }
  const s = String(raw).trim().toLowerCase()
  const map = {
    today: 'today',
    overdue: 'overdue',
    scheduled: 'scheduled',
    needed: 'needed',
    open: 'open',
    none: 'none',
  }
  const mode = map[s]
  if (!mode) {
    return { mode: null, error: '잘못된 후속관리 필터입니다.' }
  }
  return { mode, error: null }
}

/**
 * @param {Record<string, unknown>} query
 * @returns {{ from: string | null, to: string | null, error: string | null }}
 */
export function parseNextContactDateRangeQuery(query) {
  const fromRaw = query?.nextContactFrom ?? query?.next_contact_from
  const toRaw = query?.nextContactTo ?? query?.next_contact_to
  const from = fromRaw == null || String(fromRaw).trim() === '' ? null : String(fromRaw).trim()
  const to = toRaw == null || String(toRaw).trim() === '' ? null : String(toRaw).trim()
  if (from != null && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return { from: null, to: null, error: '다음 연락 시작일은 YYYY-MM-DD 형식이어야 합니다.' }
  }
  if (to != null && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { from: null, to: null, error: '다음 연락 종료일은 YYYY-MM-DD 형식이어야 합니다.' }
  }
  if (from != null && to != null && from > to) {
    return { from: null, to: null, error: '다음 연락 시작일은 종료일보다 늦을 수 없습니다.' }
  }
  if (!from && !to) {
    return { from: null, to: null, error: null }
  }
  return { from, to, error: null }
}
