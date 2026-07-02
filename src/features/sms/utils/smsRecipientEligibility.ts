import type { SmsSelectedRecipient } from '../types/smsBulkRecipient.types'

const BLOCKED_LABELS: Record<string, string> = {
  no_phone: '연락처 없음',
  invalid_phone: '전화번호 형식 오류',
  opt_out: '수신거부',
  duplicate_phone: '중복 전화번호',
  already_added: '이미 추가됨',
}

export function formatSmsBlockedReason(code: string | null | undefined): string {
  if (!code) {
    return '발송 가능'
  }
  return BLOCKED_LABELS[code] ?? code
}

export function summarizeSelectedRecipients(recipients: SmsSelectedRecipient[]) {
  const total = recipients.length
  const sendable = recipients.filter((r) => r.canSend).length
  const excluded = total - sendable
  const skipCounts: Record<string, number> = {}
  for (const row of recipients) {
    if (row.canSend || !row.blockedReason) {
      continue
    }
    skipCounts[row.blockedReason] = (skipCounts[row.blockedReason] ?? 0) + 1
  }
  return { total, sendable, excluded, skipCounts }
}

export function formatCompactGender(
  gender: 'male' | 'female' | null,
  genderLabel: string,
): string {
  if (gender === 'male') {
    return '남'
  }
  if (gender === 'female') {
    return '여'
  }
  return genderLabel || '-'
}

export function formatCompactSangnyeong(label: string): string {
  const match = label.match(/D-\d+/i)
  if (match) {
    return match[0]
  }
  return label || '-'
}

export function formatGroupLastSentAt(lastSentAt: string | null | undefined): string {
  if (!lastSentAt) {
    return '최근 발송 없음'
  }
  const date = new Date(lastSentAt)
  if (Number.isNaN(date.getTime())) {
    return '최근 발송 없음'
  }
  return date.toISOString().slice(0, 10)
}

export function buildGroupAppendToCartMessage(
  groupTotal: number,
  addedCount: number,
  skipped: Record<string, number>,
): string {
  const parts = [`그룹 고객 ${groupTotal}명 중 ${addedCount}명이 추가되었습니다.`]
  const detail: string[] = []
  if (skipped.already_added) {
    detail.push(`이미 추가된 고객 ${skipped.already_added}명`)
  }
  if (skipped.duplicate_phone) {
    detail.push(`중복 번호 ${skipped.duplicate_phone}건`)
  }
  if (detail.length > 0) {
    parts.push(`${detail.join(', ')}은 제외되었습니다.`)
  }
  return parts.join(' ')
}

export function buildCartAppendToGroupMessage(cartTotal: number, addedCount: number, alreadyInGroup: number): string {
  const parts = [`현재 선택 대상 ${cartTotal}명 중 ${addedCount}명이 그룹에 추가되었습니다.`]
  if (alreadyInGroup > 0) {
    parts.push(`이미 포함된 고객 ${alreadyInGroup}명은 제외되었습니다.`)
  }
  return parts.join(' ')
}

export function buildAddResultMessage(addedCount: number, skipped: Record<string, number>): string {
  const parts = [`${addedCount}명이 추가되었습니다.`]
  const detail: string[] = []
  if (skipped.already_added) {
    detail.push(`이미 추가된 고객 ${skipped.already_added}명`)
  }
  if (skipped.duplicate_phone) {
    detail.push(`중복 전화번호 ${skipped.duplicate_phone}건`)
  }
  if (skipped.no_phone) {
    detail.push(`연락처 없음 ${skipped.no_phone}명`)
  }
  if (skipped.invalid_phone) {
    detail.push(`전화번호 형식 오류 ${skipped.invalid_phone}명`)
  }
  if (skipped.opt_out) {
    detail.push(`수신거부 ${skipped.opt_out}명`)
  }
  if (detail.length > 0) {
    parts.push(`${detail.join(', ')}은 제외되었습니다.`)
  }
  return parts.join(' ')
}
