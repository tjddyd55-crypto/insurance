/**
 * 고객 프로필 → PDF 필드값 자동 매핑.
 *
 * 책임:
 *   - `field.customerMapping` 값을 보고 고객 프로필의 해당 속성을 필드 값으로 주입한다.
 *   - DB I/O 는 하지 않는다 — 호출측이 이미 조회한 프로필 객체를 넣어 준다.
 *     (테스트 용이성 + 레포지토리-도메인 경계 유지)
 *
 * 주입 규칙:
 *   - 매핑이 없으면 손대지 않는다(사용자 입력 그대로).
 *   - 매핑이 있고 프로필 값이 존재하면, 사용자가 보낸 값을 무시하고 프로필 값으로 덮어쓴다.
 *   - 매핑이 있지만 프로필 값이 비어 있으면 사용자 입력을 살린다.
 *     (사용자가 없는 정보를 직접 입력해 발급할 수 있어야 UX 가 막히지 않음)
 *
 * 값 형식:
 *   - dob: "YYYY-MM-DD" 문자열로 직렬화(DB 의 DATE 는 pg 가 Date 객체로 돌려준다).
 *   - 나머지는 문자열 그대로 trim.
 */

/**
 * @typedef {{
 *   display_name?: string | null,
 *   phone_number?: string | null,
 *   customer_dob?: string | Date | null,
 *   customer_address?: string | null,
 * }} CustomerProfileRow
 */

/** 프로필 row 의 DATE 를 "YYYY-MM-DD" 로 안전 직렬화. */
function formatDob(value) {
  if (value == null) return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const str = String(value).trim()
  /* 이미 YYYY-MM-DD 면 그대로, 아니면 ISO 앞 10자리 시도. */
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.slice(0, 10)
  return ''
}

/**
 * customerMapping → 프로필 row 의 실제 값 추출.
 * 새 매핑 키가 늘어나면 이 맵에 한 줄만 추가한다.
 *
 * @param {CustomerProfileRow | null | undefined} profile
 * @param {'name' | 'dob' | 'phone' | 'address'} mapping
 * @returns {string} trim 된 빈 문자열이면 "값 없음" 을 의미.
 */
export function pickMappedValue(profile, mapping) {
  if (!profile) return ''
  switch (mapping) {
    case 'name':
      return (profile.display_name ?? '').toString().trim()
    case 'phone':
      return (profile.phone_number ?? '').toString().trim()
    case 'dob':
      return formatDob(profile.customer_dob).trim()
    case 'address':
      return (profile.customer_address ?? '').toString().trim()
    default:
      return ''
  }
}

/**
 * 필드 정의와 사용자 입력값을 합쳐, 자동 매핑이 가능한 필드는 프로필 값으로 덮어쓴다.
 *
 * @param {Array<{ fieldKey: string, customerMapping: 'name'|'dob'|'phone'|'address'|null }>} fields
 * @param {Record<string, unknown>} userValues
 * @param {CustomerProfileRow | null | undefined} profile
 * @returns {Record<string, unknown>} 새 객체(불변 유지).
 */
export function injectCustomerValues(fields, userValues, profile) {
  const out = { ...(userValues ?? {}) }
  for (const f of fields) {
    if (!f.customerMapping) continue
    const mapped = pickMappedValue(profile, f.customerMapping)
    if (mapped) {
      out[f.fieldKey] = mapped
    }
  }
  return out
}
