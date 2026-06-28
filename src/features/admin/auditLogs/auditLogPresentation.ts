export type AuditLogCategory =
  | 'all'
  | 'login'
  | 'user'
  | 'notice'
  | 'contract'
  | 'billing'
  | 'system'
  | 'other'

export type EnrichedSecurityAuditLogRow = {
  id: number | string
  occurredAt: string
  created_at: string
  action: string
  actionLabel: string
  category: AuditLogCategory
  actorUserId: string
  actorUsername: string | null
  actorDisplayName: string
  role: string
  roleLabel: string
  target: string | null
  target_type: string | null
  target_id: string | null
  targetLabel: string
  gaId: number | null
  ga_id: number | null
  company_id: number | null
  summary: string
  meta: Record<string, unknown>
  ipAddress: string | null
  userAgent: string | null
}

export type AuditLogActionFilter =
  | ''
  | 'login_success'
  | 'LOGIN_FAILED'
  | 'user'
  | 'notice'
  | 'contract'
  | 'billing'
  | 'other'

export const AUDIT_LOG_TABS: ReadonlyArray<{ id: AuditLogCategory; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'login', label: '로그인 기록' },
  { id: 'user', label: '사용자 관리' },
  { id: 'notice', label: '공지 관리' },
  { id: 'contract', label: '전자서명' },
  { id: 'billing', label: '결제/구독' },
  { id: 'system', label: '시스템' },
]

export const AUDIT_LOG_ACTION_FILTER_OPTIONS: ReadonlyArray<{ value: AuditLogActionFilter; label: string }> = [
  { value: '', label: '전체' },
  { value: 'login_success', label: '로그인 성공' },
  { value: 'LOGIN_FAILED', label: '로그인 실패' },
  { value: 'user', label: '사용자 관리' },
  { value: 'notice', label: '공지 관리' },
  { value: 'contract', label: '전자서명' },
  { value: 'billing', label: '결제/구독' },
  { value: 'other', label: '기타' },
]

export function formatAuditLogDateTime(iso: string | null | undefined, compact = false): string {
  if (!iso) {
    return '—'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  const year = pick('year')
  const month = pick('month').padStart(2, '0')
  const day = pick('day').padStart(2, '0')
  const hour = pick('hour')
  const minute = pick('minute')
  const dayPeriod = pick('dayPeriod')
  if (compact) {
    return `${month}.${day} ${dayPeriod} ${hour}:${minute}`
  }
  return `${year}.${month}.${day} ${dayPeriod} ${hour}:${minute}`
}

export function getAuditRowActionLabel(row: {
  actionLabel?: string
  action: string
}): string {
  return row.actionLabel?.trim() || row.action
}

export function getAuditRowActorLabel(row: {
  actorDisplayName?: string
  actorUsername?: string | null
  actor_user_id?: string
}): string {
  return row.actorDisplayName?.trim() || row.actorUsername?.trim() || row.actor_user_id?.trim() || '—'
}

export function getAuditRowRoleLabel(row: {
  roleLabel?: string
  role?: string
  actor_role?: string
}): string {
  return row.roleLabel?.trim() || row.role?.trim() || row.actor_role?.trim() || '—'
}

export function getAuditRowTargetLabel(row: { targetLabel?: string }): string {
  return row.targetLabel?.trim() || '—'
}

export function getAuditRowSummary(row: { summary?: string; actionLabel?: string; action: string }): string {
  return row.summary?.trim() || row.actionLabel?.trim() || row.action || '—'
}

export function buildAuditLogQueryParams(input: {
  limit?: number
  tabCategory: AuditLogCategory
  actionFilter: AuditLogActionFilter
  actorQ: string
  since: string
}): URLSearchParams {
  const q = new URLSearchParams()
  if (input.limit != null) {
    q.set('limit', String(input.limit))
  }
  if (input.since.trim()) {
    q.set('since', input.since.trim())
  }
  if (input.actorQ.trim()) {
    q.set('actor_q', input.actorQ.trim())
  }

  const actionFilter = input.actionFilter
  if (actionFilter === 'login_success' || actionFilter === 'LOGIN_FAILED') {
    q.set('action', actionFilter)
  } else if (actionFilter) {
    q.set('category', actionFilter)
  } else if (input.tabCategory !== 'all') {
    q.set('category', input.tabCategory)
  }

  return q
}
