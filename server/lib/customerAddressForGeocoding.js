/**
 * customers.address 저장 문자열 → geocoding용 주소 추출.
 * 프론트 formatAddressForSave 규칙: "(우편번호) 기본주소 상세주소"
 */

const ZIP_PREFIX_RE = /^\(\d{5}\)\s*/
const DETAIL_SUFFIX_RE = /\s+(\S*(?:호|층|동)(?:\s*\S*)?)$/

/**
 * @param {unknown} stored
 * @returns {{
 *   displayAddress: string
 *   geocodingQuery: string
 *   hasAddress: boolean
 * }}
 */
export function parseStoredCustomerAddress(stored) {
  const displayAddress = String(stored ?? '').trim()
  if (!displayAddress) {
    return { displayAddress: '', geocodingQuery: '', hasAddress: false }
  }

  let base = displayAddress.replace(ZIP_PREFIX_RE, '').trim()
  if (!base) {
    return { displayAddress, geocodingQuery: '', hasAddress: false }
  }

  let geocodingQuery = base
  const withoutDetail = base.replace(DETAIL_SUFFIX_RE, '').trim()
  if (withoutDetail.length >= 4) {
    geocodingQuery = withoutDetail
  }

  return { displayAddress, geocodingQuery, hasAddress: true }
}

/**
 * @param {unknown} a
 * @param {unknown} b
 */
export function normalizeAddressSnapshot(a, b) {
  return String(a ?? '').trim() === String(b ?? '').trim()
}
