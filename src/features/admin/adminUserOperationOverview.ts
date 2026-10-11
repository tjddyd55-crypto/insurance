import type { AdminUserRow } from '../auth/authApi'
import { formatKstDateDots } from '../../utils/displayDateTime'

const KST = 'Asia/Seoul'

export type AdminUserListSort =
  | 'created_desc'
  | 'created_asc'
  | 'last_login_desc'
  | 'name_asc'
  | 'ga_asc'

export type AdminUserNewMemberFilter = '' | 'monthly_new'

export type AdminUserActivityFilter =
  | ''
  | 'today'
  | '7d'
  | '30d'
  | 'inactive_30d'
  | 'never'

export type AdminUserListViewMode = 'flat' | 'ga_group'

export const ADMIN_USER_SORT_OPTIONS: { value: AdminUserListSort; label: string }[] = [
  { value: 'created_desc', label: '가입일 최신순' },
  { value: 'created_asc', label: '가입일 오래된순' },
  { value: 'last_login_desc', label: '최근 접속순' },
  { value: 'name_asc', label: '이름순' },
  { value: 'ga_asc', label: 'GA순' },
]

export const ADMIN_USER_NEW_MEMBER_FILTER_OPTIONS: { value: AdminUserNewMemberFilter; label: string }[] =
  [
    { value: '', label: '전체' },
    { value: 'monthly_new', label: '이번 달 신규' },
  ]

export const ADMIN_USER_ACTIVITY_FILTER_OPTIONS: { value: AdminUserActivityFilter; label: string }[] =
  [
    { value: '', label: '전체' },
    { value: 'today', label: '오늘 접속' },
    { value: '7d', label: '최근 7일' },
    { value: '30d', label: '최근 30일' },
    { value: 'inactive_30d', label: '30일 이상 미접속' },
    { value: 'never', label: '접속 기록 없음' },
  ]

export type AdminUsersOverviewSummary = {
  totalUsers: number
  monthlyNewUsers: number
  todayActiveUsers: number
  activeLast7DaysUsers: number
}

function getKstDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

/** KST 달력월 [startMs, endMs) */
export function resolveKstMonthBoundsMs(reference = new Date()): { startMs: number; endMs: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(reference)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const start = new Date(
    `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`,
  )
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const end = new Date(
    `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+09:00`,
  )
  return { startMs: start.getTime(), endMs: end.getTime() }
}

export function isAdminUserJoinedThisMonth(
  createdAt: string | null | undefined,
  reference = new Date(),
): boolean {
  if (!createdAt) return false
  const t = new Date(createdAt).getTime()
  if (Number.isNaN(t)) return false
  const { startMs, endMs } = resolveKstMonthBoundsMs(reference)
  return t >= startMs && t < endMs
}

export function formatAdminUserJoinDate(createdAt: string | null | undefined): string {
  if (!createdAt) return '—'
  const formatted = formatKstDateDots(createdAt)
  return formatted || '—'
}

function parseLastLoginMs(row: AdminUserRow): number | null {
  const raw = row.last_login_at
  if (!raw) return null
  const t = new Date(raw).getTime()
  return Number.isNaN(t) ? null : t
}

function kstDayStartMs(reference = new Date()): number {
  const key = getKstDateKey(reference.toISOString())
  return new Date(`${key}T00:00:00+09:00`).getTime()
}

export function matchesAdminUserActivityFilter(
  row: AdminUserRow,
  filter: AdminUserActivityFilter,
  reference = new Date(),
): boolean {
  if (!filter) return true
  const lastMs = parseLastLoginMs(row)
  const todayStart = kstDayStartMs(reference)
  if (filter === 'never') return lastMs == null
  if (lastMs == null) return false
  if (filter === 'today') return lastMs >= todayStart
  if (filter === '7d') return lastMs >= todayStart - 6 * 86_400_000
  if (filter === '30d') return lastMs >= todayStart - 29 * 86_400_000
  if (filter === 'inactive_30d') return lastMs < todayStart - 30 * 86_400_000
  return true
}

export function matchesAdminUserNewMemberFilter(
  row: AdminUserRow,
  filter: AdminUserNewMemberFilter,
  reference = new Date(),
): boolean {
  if (filter !== 'monthly_new') return true
  return isAdminUserJoinedThisMonth(row.created_at, reference)
}

export function sortAdminUserRows(rows: AdminUserRow[], sort: AdminUserListSort): AdminUserRow[] {
  const out = [...rows]
  out.sort((a, b) => {
    switch (sort) {
      case 'created_asc': {
        const ca = new Date(a.created_at).getTime()
        const cb = new Date(b.created_at).getTime()
        if (ca !== cb) return ca - cb
        return String(b.id).localeCompare(String(a.id))
      }
      case 'last_login_desc': {
        const la = parseLastLoginMs(a) ?? -1
        const lb = parseLastLoginMs(b) ?? -1
        if (la !== lb) return lb - la
        return compareCreatedDesc(a, b)
      }
      case 'name_asc': {
        const na = (a.display_name || a.username).localeCompare(b.display_name || b.username, 'ko')
        if (na !== 0) return na
        return String(a.id).localeCompare(String(b.id))
      }
      case 'ga_asc': {
        const ga = a.ga_company_name.localeCompare(b.ga_company_name, 'ko')
        if (ga !== 0) return ga
        return compareCreatedDesc(a, b)
      }
      case 'created_desc':
      default:
        return compareCreatedDesc(a, b)
    }
  })
  return out
}

function compareCreatedDesc(a: AdminUserRow, b: AdminUserRow): number {
  const ca = new Date(a.created_at).getTime()
  const cb = new Date(b.created_at).getTime()
  if (ca !== cb) return cb - ca
  return String(b.id).localeCompare(String(a.id))
}

export function computeAdminUsersOverviewFromRows(
  rows: AdminUserRow[],
  reference = new Date(),
): AdminUsersOverviewSummary {
  const todayStart = kstDayStartMs(reference)
  const sevenStart = todayStart - 6 * 86_400_000
  let monthlyNewUsers = 0
  let todayActiveUsers = 0
  let activeLast7DaysUsers = 0
  for (const row of rows) {
    if (isAdminUserJoinedThisMonth(row.created_at, reference)) monthlyNewUsers += 1
    const lastMs = parseLastLoginMs(row)
    if (lastMs != null && lastMs >= todayStart) todayActiveUsers += 1
    if (lastMs != null && lastMs >= sevenStart) activeLast7DaysUsers += 1
  }
  return {
    totalUsers: rows.length,
    monthlyNewUsers,
    todayActiveUsers,
    activeLast7DaysUsers,
  }
}

export type GaUserGroup = {
  gaId: number
  gaName: string
  totalUsers: number
  monthlyNewUsers: number
  todayActiveUsers: number
  users: AdminUserRow[]
}

export function groupAdminUsersByGa(
  rows: AdminUserRow[],
  reference = new Date(),
): GaUserGroup[] {
  const map = new Map<number, GaUserGroup>()
  for (const row of rows) {
    let group = map.get(row.ga_id)
    if (!group) {
      group = {
        gaId: row.ga_id,
        gaName: row.ga_company_name,
        totalUsers: 0,
        monthlyNewUsers: 0,
        todayActiveUsers: 0,
        users: [],
      }
      map.set(row.ga_id, group)
    }
    group.users.push(row)
    group.totalUsers += 1
    if (isAdminUserJoinedThisMonth(row.created_at, reference)) group.monthlyNewUsers += 1
    const lastMs = parseLastLoginMs(row)
    const todayStart = kstDayStartMs(reference)
    if (lastMs != null && lastMs >= todayStart) group.todayActiveUsers += 1
  }
  return [...map.values()].sort((a, b) => a.gaName.localeCompare(b.gaName, 'ko'))
}
