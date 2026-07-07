import type { FormSelectOption } from '../../../components/form'

/** customers.carrier 저장값 — enum 코드 */
export const CUSTOMER_MOBILE_CARRIER_CODES = [
  'SKT',
  'KT',
  'LG_U_PLUS',
  'SKT_MVNO',
  'KT_MVNO',
  'LG_U_PLUS_MVNO',
] as const

export type CustomerMobileCarrierCode = (typeof CUSTOMER_MOBILE_CARRIER_CODES)[number]

const CARRIER_LABEL_BY_CODE: Record<CustomerMobileCarrierCode, string> = {
  SKT: 'SKT',
  KT: 'KT',
  LG_U_PLUS: 'LG U+',
  SKT_MVNO: 'SKT 알뜰폰',
  KT_MVNO: 'KT 알뜰폰',
  LG_U_PLUS_MVNO: 'LG U+ 알뜰폰',
}

/** 화면 표시 라벨 → 저장 enum (레거시 자유입력 호환) */
const CARRIER_CODE_BY_LABEL: Record<string, CustomerMobileCarrierCode> = {
  SKT: 'SKT',
  KT: 'KT',
  'LG U+': 'LG_U_PLUS',
  'LG U＋': 'LG_U_PLUS',
  'SKT 알뜰폰': 'SKT_MVNO',
  'KT 알뜰폰': 'KT_MVNO',
  'LG U+ 알뜰폰': 'LG_U_PLUS_MVNO',
  'LG U＋ 알뜰폰': 'LG_U_PLUS_MVNO',
}

export const CUSTOMER_MOBILE_CARRIER_PLACEHOLDER = '통신사를 선택해 주세요'

export const CUSTOMER_MOBILE_CARRIER_FORM_OPTIONS: FormSelectOption[] = [
  { value: '', label: CUSTOMER_MOBILE_CARRIER_PLACEHOLDER },
  ...CUSTOMER_MOBILE_CARRIER_CODES.map((code) => ({
    value: code,
    label: CARRIER_LABEL_BY_CODE[code],
  })),
]

export function isCustomerMobileCarrierCode(value: string | null | undefined): value is CustomerMobileCarrierCode {
  const s = String(value ?? '').trim()
  return (CUSTOMER_MOBILE_CARRIER_CODES as readonly string[]).includes(s)
}

/** 폼 select value — enum 코드 또는 빈 문자열 */
export function normalizeCustomerCarrierForForm(raw: string | null | undefined): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) {
    return ''
  }
  if (isCustomerMobileCarrierCode(trimmed)) {
    return trimmed
  }
  return CARRIER_CODE_BY_LABEL[trimmed] ?? trimmed
}

/** 저장 payload — enum만 허용, 그 외 레거시는 빈 문자열로 정규화하지 않고 그대로 trim (마이그레이션 없이) */
export function normalizeCustomerCarrierForSave(raw: string | null | undefined): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) {
    return ''
  }
  if (isCustomerMobileCarrierCode(trimmed)) {
    return trimmed
  }
  const fromLabel = CARRIER_CODE_BY_LABEL[trimmed]
  if (fromLabel) {
    return fromLabel
  }
  return trimmed
}

/** 조회·목록·PDF 등 표시용 */
export function formatCustomerMobileCarrierDisplay(raw: string | null | undefined): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) {
    return ''
  }
  if (isCustomerMobileCarrierCode(trimmed)) {
    return CARRIER_LABEL_BY_CODE[trimmed]
  }
  return trimmed
}
