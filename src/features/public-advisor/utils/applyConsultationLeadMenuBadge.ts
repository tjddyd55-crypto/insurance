import type { GaTenantDashboardMenuEntry } from '../../dashboard/gaTenantMenu'

export const CONSULTATION_LEADS_MENU_PATH = '/consultation-leads'

export function applyConsultationLeadMenuBadge(
  entries: GaTenantDashboardMenuEntry[],
  newCount: number | null | undefined,
): GaTenantDashboardMenuEntry[] {
  const count = Number(newCount ?? 0)
  if (!Number.isFinite(count) || count <= 0) {
    return entries
  }
  const badge = String(count)
  return entries.map((entry) => {
    if (entry.type !== 'link' || entry.path !== CONSULTATION_LEADS_MENU_PATH) {
      return entry
    }
    return { ...entry, badge }
  })
}
