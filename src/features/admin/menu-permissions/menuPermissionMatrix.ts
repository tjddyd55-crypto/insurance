import {
  buildAppMenuForSession,
  type AppMenuBuildOptions,
  type GaTenantDashboardMenuEntry,
} from '../../dashboard/gaTenantMenu'
import type {
  MenuAudienceId,
  MenuAudienceSummary,
  MenuPermissionCell,
  MenuPermissionMatrixOptions,
  MenuPermissionMatrixResult,
  MenuPermissionRow,
  MenuPermissionStatus,
  PaidAccessMode,
} from './menuPermissionMatrix.types'
import { MENU_PERMISSION_PREVIEW_GA_CODE } from './menuPermissionMatrix.types'

export const PRIMARY_MATRIX_AUDIENCES: MenuAudienceId[] = [
  'GENERAL_USER',
  'GA_USER',
  'GA_STAFF',
  'GA_ADMIN',
]

export const SECONDARY_MATRIX_AUDIENCES: MenuAudienceId[] = ['INSURER_MANAGER', 'LOSS_ADJUSTER']

export const MENU_AUDIENCE_LABELS: Record<
  MenuAudienceId,
  { title: string; subtitle: string; role: string; gaCode?: string; gaName?: string }
> = {
  GENERAL_USER: { title: '일반 사용자', subtitle: 'USER / GA 없음', role: 'USER', gaCode: 'GENERAL', gaName: '공용' },
  GA_USER: {
    title: 'GA 소속 사용자',
    subtitle: 'USER / GA',
    role: 'USER',
    gaCode: MENU_PERMISSION_PREVIEW_GA_CODE,
    gaName: 'GA 소속',
  },
  GA_STAFF: {
    title: 'GA 스텝',
    subtitle: 'GA_STAFF',
    role: 'GA_STAFF',
    gaCode: MENU_PERMISSION_PREVIEW_GA_CODE,
    gaName: 'GA 소속',
  },
  GA_ADMIN: {
    title: 'GA 관리자',
    subtitle: 'GA_ADMIN',
    role: 'GA_ADMIN',
    gaCode: MENU_PERMISSION_PREVIEW_GA_CODE,
    gaName: 'GA 소속',
  },
  INSURER_MANAGER: {
    title: '원수사 담당자',
    subtitle: 'INSURER_MANAGER',
    role: 'INSURER_MANAGER',
    gaCode: MENU_PERMISSION_PREVIEW_GA_CODE,
    gaName: 'GA 소속',
  },
  LOSS_ADJUSTER: {
    title: '손해사정사',
    subtitle: 'LOSS_ADJUSTER',
    role: 'LOSS_ADJUSTER',
    gaCode: MENU_PERMISSION_PREVIEW_GA_CODE,
    gaName: 'GA 소속',
  },
}

type ParsedMenuLink = {
  section: string | null
  sectionMissing: boolean
  label: string
  path: string
  entry: Extract<GaTenantDashboardMenuEntry, { type: 'link' }>
}

function normalizePath(path: string): string {
  return path.split('?')[0]?.trim() || path
}

function menuRowKey(label: string, path: string): string {
  return `${normalizePath(path)}::${label}`
}

function paidAccessFromMode(mode: PaidAccessMode): boolean {
  return mode === 'active'
}

function buildSessionMenu(
  audienceId: MenuAudienceId,
  paidAccessMode: PaidAccessMode,
  teamMenuManageVisible: boolean,
): GaTenantDashboardMenuEntry[] {
  const meta = MENU_AUDIENCE_LABELS[audienceId]
  const options: AppMenuBuildOptions = {
    teamMenuManageVisible,
    dynamicNewsletterBoards: [],
    subscriptionExpired: false,
    hasActivePaidAccess: paidAccessFromMode(paidAccessMode),
  }
  return buildAppMenuForSession(meta.role, meta.gaCode, meta.gaName, options)
}

/** buildAppMenuForSession 결과를 flat link 목록으로 (section·진단 포함) */
export function parseMenuEntriesForMatrix(entries: GaTenantDashboardMenuEntry[]): ParsedMenuLink[] {
  const result: ParsedMenuLink[] = []
  let currentSection: string | null = null
  let sectionOpenSinceDivider = true

  for (const entry of entries) {
    if (entry.type === 'section') {
      currentSection = entry.label
      sectionOpenSinceDivider = true
      continue
    }
    if (entry.type === 'divider') {
      sectionOpenSinceDivider = false
      continue
    }
    if (entry.type !== 'link') {
      continue
    }
    const sectionMissing = !sectionOpenSinceDivider && currentSection == null
    result.push({
      section: currentSection,
      sectionMissing,
      label: entry.label,
      path: entry.path,
      entry,
    })
    sectionOpenSinceDivider = true
  }
  return result
}

function deriveCellStatus(
  link: ParsedMenuLink | undefined,
  conditionalReason?: string,
): MenuPermissionCell {
  if (!link) {
    return { status: 'hidden' }
  }
  const { entry } = link
  if (conditionalReason) {
    return {
      status: 'conditional',
      reason: conditionalReason,
      path: entry.path,
      featureKey: entry.featureKey,
      badge: entry.badge,
      raw: entry,
    }
  }
  if (entry.preparing || (entry.disabled && entry.badge === '개발중')) {
    return {
      status: 'disabled',
      badge: entry.badge ?? '개발중',
      reason: 'preparing/disabled',
      path: entry.path,
      featureKey: entry.featureKey,
      raw: entry,
    }
  }
  if (entry.disabled) {
    return {
      status: 'disabled',
      badge: entry.badge,
      path: entry.path,
      featureKey: entry.featureKey,
      raw: entry,
    }
  }
  if (entry.entitlementBlocked) {
    const reasonParts: string[] = []
    if (entry.entitlementReason === 'paid_required') reasonParts.push('유료')
    if (entry.entitlementReason === 'ga_required') reasonParts.push('GA 전용')
    if (entry.badge) reasonParts.push(entry.badge)
    return {
      status: 'blocked',
      badge: entry.badge ?? (reasonParts.join(' · ') || '제한'),
      reason: reasonParts.join(' · ') || entry.entitlementReason || undefined,
      path: entry.path,
      featureKey: entry.featureKey,
      raw: entry,
    }
  }
  return {
    status: 'visible',
    badge: entry.badge,
    path: entry.path,
    featureKey: entry.featureKey,
    raw: entry,
  }
}

const TEAM_MANAGE_CONDITION = 'USER && team owner (teamMenuManageVisible)'

function buildAudienceLinkMap(
  audienceId: MenuAudienceId,
  paidAccessMode: PaidAccessMode,
  teamMenuManageVisible: boolean,
): Map<string, ParsedMenuLink> {
  const entries = buildSessionMenu(audienceId, paidAccessMode, teamMenuManageVisible)
  const parsed = parseMenuEntriesForMatrix(entries)
  const map = new Map<string, ParsedMenuLink>()
  for (const link of parsed) {
    map.set(menuRowKey(link.label, link.path), link)
  }
  return map
}

function collectConditionalKeys(
  audienceId: MenuAudienceId,
  paidAccessMode: PaidAccessMode,
): Set<string> {
  if (audienceId !== 'GENERAL_USER' && audienceId !== 'GA_USER') {
    return new Set()
  }
  const baseline = buildAudienceLinkMap(audienceId, paidAccessMode, false)
  const withTeam = buildAudienceLinkMap(audienceId, paidAccessMode, true)
  const keys = new Set<string>()
  for (const key of withTeam.keys()) {
    if (!baseline.has(key)) {
      keys.add(key)
    }
  }
  return keys
}

function summarizeAudience(
  audienceId: MenuAudienceId,
  links: ParsedMenuLink[],
  cellsForAudience: MenuPermissionCell[],
): MenuAudienceSummary {
  const meta = MENU_AUDIENCE_LABELS[audienceId]
  let visibleCount = 0
  let blockedCount = 0
  let disabledCount = 0
  for (const cell of cellsForAudience) {
    if (cell.status === 'visible' || cell.status === 'conditional') visibleCount += 1
    if (cell.status === 'blocked') blockedCount += 1
    if (cell.status === 'disabled') disabledCount += 1
  }
  return {
    id: audienceId,
    title: meta.title,
    subtitle: meta.subtitle,
    linkCount: links.length,
    visibleCount,
    blockedCount,
    disabledCount,
  }
}

/** 정책 SSOT — buildAppMenuForSession 결과만 해석 (별도 permission table 없음) */
export function buildMenuPermissionMatrix(
  options: MenuPermissionMatrixOptions,
): MenuPermissionMatrixResult {
  const audiences = PRIMARY_MATRIX_AUDIENCES
  const audienceMaps = new Map<MenuAudienceId, Map<string, ParsedMenuLink>>()
  const conditionalByAudience = new Map<MenuAudienceId, Set<string>>()

  for (const audienceId of audiences) {
    audienceMaps.set(audienceId, buildAudienceLinkMap(audienceId, options.paidAccessMode, false))
    conditionalByAudience.set(audienceId, collectConditionalKeys(audienceId, options.paidAccessMode))
  }

  const rowKeySet = new Set<string>()
  for (const map of audienceMaps.values()) {
    for (const key of map.keys()) rowKeySet.add(key)
  }
  for (const audienceId of ['GENERAL_USER', 'GA_USER'] as const) {
    const withTeam = buildAudienceLinkMap(audienceId, options.paidAccessMode, true)
    for (const key of withTeam.keys()) rowKeySet.add(key)
  }

  const rows: MenuPermissionRow[] = [...rowKeySet].map((rowKey) => {
    const sample =
      audienceMaps.get('GENERAL_USER')?.get(rowKey) ??
      audienceMaps.get('GA_USER')?.get(rowKey) ??
      buildAudienceLinkMap('GENERAL_USER', options.paidAccessMode, true).get(rowKey) ??
      [...audienceMaps.values()].map((m) => m.get(rowKey)).find(Boolean)

    const labelSet = new Set<string>()
    for (const map of audienceMaps.values()) {
      const link = map.get(rowKey)
      if (link) labelSet.add(link.label)
    }
    const labelNotes =
      labelSet.size > 1 ? `역할별 라벨: ${[...labelSet].join(' / ')}` : ''

    const cells = {} as Record<MenuAudienceId, MenuPermissionCell>
    for (const audienceId of audiences) {
      const map = audienceMaps.get(audienceId)!
      const link = map.get(rowKey)
      const conditionalOnly = conditionalByAudience.get(audienceId)?.has(rowKey) && !link
      const conditionalReason = conditionalOnly ? TEAM_MANAGE_CONDITION : undefined
      if (conditionalOnly) {
        const withTeamLink = buildAudienceLinkMap(audienceId, options.paidAccessMode, true).get(rowKey)
        cells[audienceId] = deriveCellStatus(withTeamLink, conditionalReason)
      } else {
        cells[audienceId] = deriveCellStatus(link, undefined)
      }
    }

    return {
      rowKey,
      section: sample?.section ?? null,
      sectionMissing: sample?.sectionMissing ?? false,
      menuLabel: sample?.label ?? rowKey.split('::')[1] ?? rowKey,
      primaryPath: sample?.path ?? rowKey.split('::')[0] ?? '',
      labelNotes,
      cells,
    }
  })

  rows.sort((a, b) => {
    const sectionA = a.section ?? (a.sectionMissing ? '\uffff' : '')
    const sectionB = b.section ?? (b.sectionMissing ? '\uffff' : '')
    if (sectionA !== sectionB) return sectionA.localeCompare(sectionB, 'ko')
    return a.menuLabel.localeCompare(b.menuLabel, 'ko')
  })

  const summaries = audiences.map((audienceId) => {
    const map = audienceMaps.get(audienceId)!
    const links = [...map.values()]
    const cellsForAudience = rows.map((row) => row.cells[audienceId])
    return summarizeAudience(audienceId, links, cellsForAudience)
  })

  return { rows, summaries, audiences }
}

export function buildSecondaryChannelMatrix(
  options: MenuPermissionMatrixOptions,
): MenuPermissionMatrixResult {
  const audiences = SECONDARY_MATRIX_AUDIENCES
  const audienceMaps = new Map<MenuAudienceId, Map<string, ParsedMenuLink>>()
  for (const audienceId of audiences) {
    audienceMaps.set(audienceId, buildAudienceLinkMap(audienceId, options.paidAccessMode, false))
  }
  const rowKeySet = new Set<string>()
  for (const map of audienceMaps.values()) {
    for (const key of map.keys()) rowKeySet.add(key)
  }
  const rows: MenuPermissionRow[] = [...rowKeySet].map((rowKey) => {
    const sample = [...audienceMaps.values()].map((m) => m.get(rowKey)).find(Boolean)
    const cells = {} as Record<MenuAudienceId, MenuPermissionCell>
    for (const audienceId of audiences) {
      cells[audienceId] = deriveCellStatus(audienceMaps.get(audienceId)!.get(rowKey))
    }
    return {
      rowKey,
      section: sample?.section ?? null,
      sectionMissing: sample?.sectionMissing ?? false,
      menuLabel: sample?.label ?? rowKey,
      primaryPath: sample?.path ?? '',
      labelNotes: '',
      cells,
    }
  })
  const summaries = audiences.map((audienceId) => {
    const links = [...audienceMaps.get(audienceId)!.values()]
    const cellsForAudience = rows.map((row) => row.cells[audienceId])
    return summarizeAudience(audienceId, links, cellsForAudience)
  })
  return { rows, summaries, audiences }
}

/** 테스트·동기화 — audience별 buildAppMenuForSession link 집합과 matrix cell 일치 */
export function extractBuiltMenuLinkKeys(
  audienceId: MenuAudienceId,
  paidAccessMode: PaidAccessMode,
): Set<string> {
  const map = buildAudienceLinkMap(audienceId, paidAccessMode, false)
  return new Set(map.keys())
}

export function matrixRowKeysForAudience(
  matrix: MenuPermissionMatrixResult,
  audienceId: MenuAudienceId,
): Set<string> {
  const keys = new Set<string>()
  for (const row of matrix.rows) {
    if (row.cells[audienceId]?.status !== 'hidden') {
      keys.add(row.rowKey)
    }
  }
  return keys
}

export function statusesEqualAcrossPrimaryAudiences(row: MenuPermissionRow): boolean {
  const statuses = PRIMARY_MATRIX_AUDIENCES.map((id) => row.cells[id]?.status ?? 'hidden')
  return statuses.every((s) => s === statuses[0])
}

export function statusDisplayLabel(status: MenuPermissionStatus, cell: MenuPermissionCell): string {
  switch (status) {
    case 'visible':
      return '○'
    case 'hidden':
      return '×'
    case 'blocked':
      return cell.badge?.includes('유료') || cell.badge?.includes('GA') ? '제한' : '제한'
    case 'disabled':
      return '개발중'
    case 'conditional':
      return '조건부'
    default:
      return '×'
  }
}
