import type { GaTenantDashboardMenuEntry } from '../dashboard/gaTenantMenu'
import {
  evaluateFeatureAccess,
  formatFeatureAccessBadge,
  type FeatureAccessContext,
  type FeatureKey,
} from './featureEntitlementPolicy'
import { resolveFeatureKeyFromPath } from './featureRoutePolicy'

export type MenuBoardScopeHint = {
  path: string
  boardScope?: string | null
}

/**
 * 메뉴 path 를 숨기지 않고 entitlement badge 만 부여한다.
 */
export function applyEntitlementMenuBadges(
  entries: GaTenantDashboardMenuEntry[],
  ctx: FeatureAccessContext,
  boardScopeHints: MenuBoardScopeHint[] = [],
): GaTenantDashboardMenuEntry[] {
  const scopeByPath = new Map(
    boardScopeHints.map((hint) => [hint.path.split('?')[0] ?? hint.path, hint.boardScope ?? null]),
  )

  return entries.map((entry) => {
    if (entry.type !== 'link' || entry.disabled || entry.preparing || !entry.path) {
      return entry
    }
    const normalizedPath = entry.path.split('?')[0] ?? entry.path
    const featureKey = resolveFeatureKeyFromPath(normalizedPath, {
      newsletterBoardScope: scopeByPath.get(normalizedPath) ?? null,
    })
    if (!featureKey) {
      return entry
    }
    const verdict = evaluateFeatureAccess(featureKey as FeatureKey, ctx)
    const badge = formatFeatureAccessBadge(verdict.badges)
    if (!badge) {
      return entry
    }
    return {
      ...entry,
      badge: entry.badge ? `${entry.badge} · ${badge}` : badge,
      entitlementBlocked: true,
      entitlementReason: verdict.reason,
      featureKey,
    }
  })
}
