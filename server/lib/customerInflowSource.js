/**
 * 고객 유입 경로 — DB/API 공통 옵션.
 */

export const CUSTOMER_INFLOW_SOURCE_OPTIONS = [
  'DB수급',
  '소개',
  '지인',
  '기존고객',
  '광고/마케팅',
  '기타',
]

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: string | null } | { ok: false, message: string }}
 */
export function normalizeInflowSourceForDb(raw) {
  if (raw == null) {
    return { ok: true, value: null }
  }
  const s = String(raw).trim()
  if (!s || s === '미지정') {
    return { ok: true, value: null }
  }
  if (CUSTOMER_INFLOW_SOURCE_OPTIONS.includes(s)) {
    return { ok: true, value: s }
  }
  return { ok: false, message: '잘못된 유입 경로입니다.' }
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {string | null}
 */
export function inflowSourceFromDbRow(row) {
  const raw = row?.inflow_source ?? row?.inflowSource
  if (raw == null) {
    return null
  }
  const s = String(raw).trim()
  return s || null
}

/**
 * @param {Record<string, unknown>} query
 * @returns {{ value: string | null | '__unset__', error: string | null }}
 */
export function parseInflowSourceFilterQuery(query) {
  const raw = query?.inflowSource ?? query?.inflow_source
  if (raw == null || String(raw).trim() === '' || String(raw).trim().toLowerCase() === 'all') {
    return { value: null, error: null }
  }
  const s = String(raw).trim()
  if (s === '미지정' || s === 'unset' || s === '__unset__') {
    return { value: '__unset__', error: null }
  }
  if (CUSTOMER_INFLOW_SOURCE_OPTIONS.includes(s)) {
    return { value: s, error: null }
  }
  return { value: null, error: '잘못된 유입 경로 필터입니다.' }
}
