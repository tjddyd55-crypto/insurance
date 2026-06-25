import type { ClaimRequestDetail } from '../api/claimRequestsApi'

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  }
  return raw.trim()
}

export function formatClaimRequesterLine(detail: Pick<ClaimRequestDetail, 'requesterName' | 'requesterBirthDate' | 'requesterPhone'>): string | null {
  const name = detail.requesterName?.trim()
  if (!name) {
    return null
  }
  const parts = [name]
  const birth = detail.requesterBirthDate?.trim()
  if (birth) {
    parts.push(birth)
  }
  const phone = detail.requesterPhone?.trim()
  if (phone) {
    parts.push(formatPhoneDisplay(phone))
  }
  return parts.join(' · ')
}

export function claimRequestMessageText(detail: Pick<ClaimRequestDetail, 'memo' | 'title'>): string {
  const memo = detail.memo?.trim()
  if (memo) {
    return memo
  }
  const title = detail.title?.trim()
  if (title) {
    return title
  }
  return ''
}
