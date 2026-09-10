export type CustomerBusinessInfo = {
  representativeName: string
  businessNumber: string
  businessAddress: string
  memo: string
}

export function normalizeCustomerBusinessInfo(raw: unknown): CustomerBusinessInfo | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const o = raw as Record<string, unknown>
  const info: CustomerBusinessInfo = {
    representativeName: String(o.representativeName ?? o.representative_name ?? '').trim(),
    businessNumber: String(o.businessNumber ?? o.business_number ?? '').trim(),
    businessAddress: String(o.businessAddress ?? o.business_address ?? '').trim(),
    memo: String(o.memo ?? '').trim(),
  }
  if (
    !info.representativeName &&
    !info.businessNumber &&
    !info.businessAddress &&
    !info.memo
  ) {
    return null
  }
  return info
}

export function emptyCustomerBusinessInfoForm(): CustomerBusinessInfo {
  return {
    representativeName: '',
    businessNumber: '',
    businessAddress: '',
    memo: '',
  }
}

export function customerBusinessInfoToForm(info: CustomerBusinessInfo | null | undefined): CustomerBusinessInfo {
  if (!info) {
    return emptyCustomerBusinessInfoForm()
  }
  return {
    representativeName: info.representativeName ?? '',
    businessNumber: info.businessNumber ?? '',
    businessAddress: info.businessAddress ?? '',
    memo: info.memo ?? '',
  }
}

export function isCustomerBusinessInfoFormEmpty(info: CustomerBusinessInfo): boolean {
  return (
    !info.representativeName.trim() &&
    !info.businessNumber.trim() &&
    !info.businessAddress.trim() &&
    !info.memo.trim()
  )
}

/** 표시용 — 숫자·하이픈만 유지 */
export function formatBusinessNumberDisplay(raw: string): string {
  const digits = String(raw ?? '').replace(/[^\d]/g, '')
  if (!digits) {
    return ''
  }
  if (digits.length <= 3) {
    return digits
  }
  if (digits.length <= 5) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 10)}`
}
