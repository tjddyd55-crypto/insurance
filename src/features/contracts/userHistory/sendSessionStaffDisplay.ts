/** FC·USER 발송 내역 화면용 상태 라벨·날짜 포맷 */

import {
  formatKstDateTimeDisplay,
  formatKstDateTimeParts,
} from '../../../utils/displayDateTime'

export type StaffSessionDateParts = { date: string; time: string }

/** 표 시각: 첫 줄 YYYY.MM.DD, 둘째 줄 오전/오후 시:분 */
export function formatStaffSessionDateParts(value: string | Date | null | undefined): StaffSessionDateParts | null {
  return formatKstDateTimeParts(value)
}

export function formatStaffSessionDate(value: string | Date | null | undefined): string {
  return formatKstDateTimeDisplay(value, '—')
}

/** 증빙 해시 표시 — 최대 12자 prefix */
export function formatEvidenceHashForTable(prefix: string | null | undefined, maxLen = 12): string {
  if (prefix == null || String(prefix).trim() === '') {
    return ''
  }
  const p = String(prefix).trim()
  const cap = Math.max(1, Math.min(maxLen, 12))
  return p.length <= cap ? p : p.slice(0, cap)
}

export function staffDocumentStatusLabel(status: string): string {
  const s = String(status ?? '').trim()
  if (s === 'pending') {
    return '대기'
  }
  if (s === 'viewed') {
    return '열람'
  }
  if (s === 'signing') {
    return '작성 중'
  }
  if (s === 'signed') {
    return '서명됨'
  }
  if (s === 'completed') {
    return '완료'
  }
  return s || '—'
}

export function staffSendSessionDisplayLabel(
  sessionStatus: string,
  opts?: { hasSignedNotCompleted?: boolean },
): string {
  const st = String(sessionStatus ?? '')
  const signedPending = Boolean(opts?.hasSignedNotCompleted)
  if (st === 'cancelled') {
    return '취소'
  }
  if (st === 'expired') {
    return '만료'
  }
  if (st === 'completed') {
    return '완료'
  }
  if (st === 'pending') {
    return '발송됨'
  }
  if (st === 'opened') {
    return '열람'
  }
  if (st === 'identity_verified') {
    return '인증 완료'
  }
  if (st === 'signing') {
    return signedPending ? '서명 완료' : '작성 중'
  }
  return st || '—'
}
