import { normalizeKrMobile } from '../../lib/phoneNormalize'

/** 화면 표시용 — DB/전송은 normalizeKrMobile 숫자만 사용 */
export function formatKrMobileDisplay(raw: string | undefined | null): string {
  const digits = normalizeKrMobile(raw)
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return String(raw ?? '').trim() || digits
}

export const ALIGO_API_SETTINGS_URL = 'https://smartsms.aligo.in/admin/api/auth.html'
