/** FC·USER 발송 내역 화면용 상태 라벨·날짜 포맷 */

export function formatStaffSessionDate(value: string | Date | null | undefined): string {
  if (value == null) {
    return '—'
  }
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) {
    return '—'
  }
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
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
