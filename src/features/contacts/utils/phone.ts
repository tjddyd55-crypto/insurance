export function normalizePhoneNumber(raw: string): string {
  return raw.replace(/\D/g, '')
}

/** tel: 등에 쓰는 숫자만 추출 */
export function cleanPhone(phone: string): string {
  return normalizePhoneNumber(phone)
}

/**
 * 보험사 연락처 카드 표시용 (11·10자리 하이픈 위주). 그 외는 원문 유지.
 */
export function formatPhone(phone: string): string {
  if (!phone) {
    return ''
  }
  const cleaned = phone.replace(/[^0-9]/g, '')
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2,3})(\d{3,4})(\d{4})/, '$1-$2-$3')
  }
  return phone.trim() || ''
}

export function formatPhoneNumber(raw: string): string {
  const digits = normalizePhoneNumber(raw)
  if (!digits) {
    return ''
  }

  if (digits.startsWith('02')) {
    if (digits.length === 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
    }
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`
  }

  return digits
}
