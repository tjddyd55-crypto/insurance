/**
 * 상담일 YYYY-MM-DD 정규화 (API 매핑·폼 input 공통).
 * - timezone으로 하루 밀리지 않도록 Date#toISOString().slice(0,10) 사용 금지.
 * - "Wed May 13" 같은 잘못된 문자열은 절대 임의 연도로 파싱하지 않는다.
 */

function isValidYmdParts(y, m, d) {
  const yi = Number(y)
  const mi = Number(m)
  const di = Number(d)
  if (!Number.isInteger(yi) || !Number.isInteger(mi) || !Number.isInteger(di)) {
    return false
  }
  if (mi < 1 || mi > 12 || di < 1 || di > 31) {
    return false
  }
  const dt = new Date(yi, mi - 1, di)
  return dt.getFullYear() === yi && dt.getMonth() + 1 === mi && dt.getDate() === di
}

function ymdFromParts(y, m, d) {
  if (!isValidYmdParts(y, m, d)) {
    return ''
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * @param {unknown} value
 * @returns {string} YYYY-MM-DD 또는 빈 문자열
 */
export function normalizeConsultationDateForInput(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return ''
  }

  const exact = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (exact) {
    return ymdFromParts(exact[1], exact[2], exact[3])
  }

  const isoPrefix = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoPrefix) {
    return ymdFromParts(isoPrefix[1], isoPrefix[2], isoPrefix[3])
  }

  const localized = raw.match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  if (localized) {
    return ymdFromParts(localized[1], localized[2], localized[3])
  }

  return ''
}

/** @param {unknown} value */
export function normalizeDateForDateInput(value) {
  const normalized = normalizeConsultationDateForInput(value)
  return normalized || null
}

/**
 * DB/API row의 consultation_date → YYYY-MM-DD
 * @param {unknown} value
 * @returns {string | null}
 */
export function formatConsultationDateYmd(value) {
  if (value == null) {
    return null
  }
  if (value instanceof Date) {
    return ymdFromParts(value.getFullYear(), value.getMonth() + 1, value.getDate()) || null
  }
  const normalized = normalizeConsultationDateForInput(value)
  return normalized || null
}
