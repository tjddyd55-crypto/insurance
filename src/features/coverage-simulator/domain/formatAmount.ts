const MAN_WON = 10_000

export function parseManWonInput(raw: string): number | null {
  const digits = String(raw ?? '').replace(/[^\d]/g, '')
  if (!digits) return null
  const value = Number(digits)
  if (!Number.isFinite(value) || value < 0) return null
  return value * MAN_WON
}

export function formatManWonInput(amount: number | null | undefined): string {
  if (amount == null || amount <= 0) return ''
  const man = Math.round(amount / MAN_WON)
  return man > 0 ? String(man) : ''
}

/** 만원 단위 입력 필드 표시용 (천 단위 콤마) */
export function formatManWonInputDisplay(amount: number | null | undefined): string {
  const digits = formatManWonInput(amount)
  if (!digits) return ''
  return Number(digits).toLocaleString('ko-KR')
}

/** 입력 중 콤마 포함 문자열 → 표시용 digits only with commas */
export function sanitizeManWonInputTyping(raw: string): string {
  const digits = String(raw ?? '').replace(/[^\d]/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('ko-KR')
}

export function formatCoverageAmountLabel(amount: number | null | undefined): string {
  if (amount == null || amount <= 0) return '없음'
  if (amount % MAN_WON === 0) {
    const man = amount / MAN_WON
    return `${man.toLocaleString('ko-KR')}만원`
  }
  return `${amount.toLocaleString('ko-KR')}원`
}

export function formatTotalAmountLabel(amount: number): string {
  if (amount <= 0) return '0원'
  if (amount >= 100_000_000 && amount % MAN_WON === 0) {
    const eok = Math.floor(amount / 100_000_000)
    const restMan = (amount % 100_000_000) / MAN_WON
    if (restMan === 0) {
      return `${eok.toLocaleString('ko-KR')}억원`
    }
    return `${eok.toLocaleString('ko-KR')}억 ${restMan.toLocaleString('ko-KR')}만원`
  }
  if (amount % MAN_WON === 0) {
    return `${(amount / MAN_WON).toLocaleString('ko-KR')}만원`
  }
  return `${amount.toLocaleString('ko-KR')}원`
}
