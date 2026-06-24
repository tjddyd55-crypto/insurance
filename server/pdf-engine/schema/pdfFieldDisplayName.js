/**
 * formatPdfFieldDisplayName — 서버 테스트용 미러 (클라이언트 TS 와 동일 규칙).
 */

/**
 * @param {{ dataGroup?: 'A' | 'B' | null, useSecondaryCustomer?: boolean, fieldLabel: string, fallbackLabel?: string }} input
 */
export function formatPdfFieldDisplayName(input) {
  const label = (input.fieldLabel || input.fallbackLabel || '').trim()
  if (!label) {
    return (input.fallbackLabel || '').trim()
  }
  const isB = input.dataGroup === 'B' || input.useSecondaryCustomer === true
  return isB ? `B-${label}` : label
}
