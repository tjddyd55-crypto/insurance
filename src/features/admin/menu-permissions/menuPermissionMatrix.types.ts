import type { GaTenantDashboardMenuEntry } from '../../dashboard/gaTenantMenu'

export const MENU_PERMISSION_PREVIEW_GA_CODE = 'SSOT_PREVIEW_GA'

export type MenuAudienceId =
  | 'GENERAL_USER'
  | 'GA_USER'
  | 'GA_STAFF'
  | 'GA_ADMIN'
  | 'INSURER_MANAGER'
  | 'LOSS_ADJUSTER'

export type MenuPermissionStatus =
  | 'visible'
  | 'hidden'
  | 'blocked'
  | 'disabled'
  | 'conditional'

export type MenuPermissionCell = {
  status: MenuPermissionStatus
  badge?: string
  reason?: string
  path?: string
  featureKey?: string
  raw?: Extract<GaTenantDashboardMenuEntry, { type: 'link' }>
}

export type MenuPermissionRow = {
  rowKey: string
  section: string | null
  sectionMissing: boolean
  menuLabel: string
  primaryPath: string
  labelNotes: string
  cells: Record<MenuAudienceId, MenuPermissionCell>
}

export type MenuAudienceSummary = {
  id: MenuAudienceId
  title: string
  subtitle: string
  linkCount: number
  visibleCount: number
  blockedCount: number
  disabledCount: number
}

export type MenuPermissionMatrixResult = {
  rows: MenuPermissionRow[]
  summaries: MenuAudienceSummary[]
  audiences: MenuAudienceId[]
}

export type PaidAccessMode = 'active' | 'free'

export type MenuPermissionMatrixOptions = {
  paidAccessMode: PaidAccessMode
}
