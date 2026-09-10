/**
 * 고객 사업자 정보 — customers 테이블 nullable 컬럼 ↔ API businessInfo 객체.
 */

const BUSINESS_NUMBER_MAX = 32
const BUSINESS_TEXT_MAX = 8000

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function trimStr(raw) {
  return String(raw ?? '').trim()
}

/**
 * 사업자번호 — 숫자·하이픈만 허용, 과도한 검증 없이 저장.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeBusinessNumberForDb(raw) {
  const s = trimStr(raw)
  if (!s) {
    return ''
  }
  const cleaned = s.replace(/[^\d-]/g, '')
  return cleaned.slice(0, BUSINESS_NUMBER_MAX)
}

/**
 * @param {unknown} raw
 * @returns {{ representativeName: string; businessNumber: string; businessAddress: string; memo: string }}
 */
export function normalizeBusinessInfoForDb(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      representativeName: '',
      businessNumber: '',
      businessAddress: '',
      memo: '',
    }
  }
  const o = raw
  return {
    representativeName: trimStr(o.representativeName ?? o.representative_name).slice(0, 200),
    businessNumber: normalizeBusinessNumberForDb(o.businessNumber ?? o.business_number),
    businessAddress: trimStr(o.businessAddress ?? o.business_address).slice(0, BUSINESS_TEXT_MAX),
    memo: trimStr(o.memo).slice(0, BUSINESS_TEXT_MAX),
  }
}

/**
 * @param {{ representativeName: string; businessNumber: string; businessAddress: string; memo: string }} info
 * @returns {boolean}
 */
export function isBusinessInfoEmpty(info) {
  return (
    !trimStr(info.representativeName) &&
    !trimStr(info.businessNumber) &&
    !trimStr(info.businessAddress) &&
    !trimStr(info.memo)
  )
}

/**
 * @param {Record<string, unknown>} row
 * @returns {{ representativeName: string; businessNumber: string; businessAddress: string; memo: string } | null}
 */
export function mapBusinessInfoFromRow(row) {
  const info = {
    representativeName: trimStr(row.business_representative_name ?? row.businessRepresentativeName),
    businessNumber: trimStr(row.business_number ?? row.businessNumber),
    businessAddress: trimStr(row.business_address ?? row.businessAddress),
    memo: trimStr(row.business_memo ?? row.businessMemo),
  }
  return isBusinessInfoEmpty(info) ? null : info
}
