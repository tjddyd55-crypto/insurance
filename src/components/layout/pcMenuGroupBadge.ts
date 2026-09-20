export function splitEntitlementBadgeLabels(badge: string): string[] {
  return badge
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * PC 상단 대분류 메뉴 badge.
 * 하위 항목이 free + gated 혼합이면 null (예: 소식지, 업무편의).
 * 모든 하위 항목이 동일 entitlement badge를 가질 때만 대분류에 표시한다.
 */
export function resolvePcMenuGroupBadgeLabels(
  items: Array<{ badge?: string | null; disabled?: boolean; preparing?: boolean }>,
): string[] | null {
  const eligibleItems = items.filter((item) => !item.disabled && !item.preparing)
  if (eligibleItems.length === 0) {
    return null
  }

  const badges = eligibleItems.map((item) => String(item.badge ?? '').trim())
  if (badges.some((badge) => !badge)) {
    return null
  }

  const firstBadge = badges[0]
  if (!badges.every((badge) => badge === firstBadge)) {
    return null
  }

  const labels = splitEntitlementBadgeLabels(firstBadge)
  return labels.length > 0 ? labels : null
}
