export const CUSTOMER_MEDICAL_QUESTION_TEXT =
  '5년안에 병원에서 진단이나 입원, 수술, 치료 또는 약복용중이신거 있으신가요?'

export const CUSTOMER_MEDICAL_QUESTION_HINT =
  '(몇년몇월/진단명/치료부위/수술명/입원 및 통원여부/원인/현상태)'

export function formatCustomerSsnUi(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim()
  if (!text) {
    return ''
  }
  const digits = text.replace(/\D/g, '')
  if (digits.length === 13) {
    return `${digits.slice(0, 6)}-${digits.slice(6)}`
  }
  return text
}

export function formatCustomerPhoneUi(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim()
  if (!text) {
    return ''
  }
  const digits = text.replace(/\D/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return text
}
