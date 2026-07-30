/** 수납 대상 목록의 사용 카드 표시 */
export function formatLinkedCardLabel(card) {
  if (!card) {
    return '연결 안 함'
  }
  const last4 = card.cardNumberLast4 ? `끝 ${card.cardNumberLast4}` : ''
  const parts = [card.label?.trim?.() || card.label, card.cardOwnerName?.trim?.() || card.cardOwnerName, last4]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '연결 안 함'
}
