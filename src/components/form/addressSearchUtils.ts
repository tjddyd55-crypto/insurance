/**
 * AddressSearchField 의 순수 유틸리티. 컴포넌트와 분리해 둬야
 * React Fast Refresh 가 안전하게 동작하고, 단위 테스트도 편하다.
 */

export interface AddressSearchValue {
  zonecode: string
  baseAddress: string
  detailAddress: string
  /** 카카오 우편번호 선택 시에만 채운다. */
  sido?: string
  sigungu?: string
  eupmyeondong?: string
  regionCaptured?: boolean
}

function isEupMyeonDongToken(token: string): boolean {
  if (!token || /\s/.test(token)) {
    return false
  }
  if (/\d+가$/.test(token)) {
    return true
  }
  if (/(로|길|대로)$/.test(token)) {
    return false
  }
  return /(읍|면|동|리)$/.test(token)
}

/** 카카오 oncomplete 원문에서 저장용 지역 칸을 고른다. */
export function regionFromPostcodeParts(parts: {
  sido?: string
  sigungu?: string
  bname?: string
  bname1?: string
  bname2?: string
}): Pick<AddressSearchValue, 'sido' | 'sigungu' | 'eupmyeondong' | 'regionCaptured'> {
  const eup = [parts.bname2, parts.bname1, parts.bname]
    .map((value) => String(value ?? '').trim())
    .find((token) => isEupMyeonDongToken(token))
  return {
    sido: String(parts.sido ?? '').trim(),
    sigungu: String(parts.sigungu ?? '').trim(),
    eupmyeondong: eup ?? '',
    regionCaptured: true,
  }
}

export function capturedAddressRegionPayload(form: {
  addressRegionCaptured?: boolean
  addressSido?: string
  addressSigungu?: string
  addressEupmyeondong?: string
}): Record<string, string> {
  if (!form.addressRegionCaptured) {
    return {}
  }
  return {
    addressSido: form.addressSido ?? '',
    addressSigungu: form.addressSigungu ?? '',
    addressEupmyeondong: form.addressEupmyeondong ?? '',
    sido: form.addressSido ?? '',
    sigungu: form.addressSigungu ?? '',
    bname: form.addressEupmyeondong ?? '',
  }
}

/**
 * 우편번호·기본주소·상세주소를 단일 저장형 문자열로 합친다.
 *
 * 규칙:
 *   - "(우편번호) 기본주소 상세주소"
 *   - 빈 조각은 제거하고 join — 공백 중복 금지
 *   - 우편번호가 없으면 괄호 블록 자체 생략
 *
 * 이 규칙이 단순해야 후일 역파싱(저장된 문자열 → 분리 입력) 이 가능하다.
 */
export function formatAddressForSave(value: AddressSearchValue): string {
  const base = value.baseAddress.trim()
  const detail = value.detailAddress.trim()
  const zip = value.zonecode.trim()
  const head = zip ? `(${zip})` : ''
  return [head, base, detail].filter(Boolean).join(' ').trim()
}

/** 저장된 단일 address 문자열을 편집 폼용으로 분해한다. */
export function parseAddressFromSave(address: string): AddressSearchValue {
  const trimmed = address.trim()
  if (!trimmed) {
    return { zonecode: '', baseAddress: '', detailAddress: '' }
  }
  const match = trimmed.match(/^\((\d{5})\)\s*(.*)$/)
  if (!match) {
    return { zonecode: '', baseAddress: trimmed, detailAddress: '' }
  }
  return {
    zonecode: match[1],
    baseAddress: match[2].trim(),
    detailAddress: '',
  }
}

/** null-safe wrapper for quick CRUD read/modal prefill. */
export function parseAddressFromStored(stored: string | null | undefined): AddressSearchValue {
  return parseAddressFromSave(String(stored ?? ''))
}
