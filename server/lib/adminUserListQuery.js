const KST = 'Asia/Seoul'

/**
 * KST 달력월 [start, end) — UTC Date
 * @param {Date} [reference]
 */
export function resolveKstMonthBoundsUtc(reference = new Date()) {
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
  return { start, end }
}

/**
 * @param {string | null | undefined} raw
 * @returns {'monthly' | null}
 */
export function parseAdminUserNewMemberFilter(raw) {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'monthly' || v === 'monthly_new' || v === 'yes') return 'monthly'
  return null
}

/**
 * @param {string | null | undefined} raw
 */
export function parseAdminUserActivityFilter(raw) {
  const v = String(raw ?? '').trim().toLowerCase()
  const allowed = new Set(['today', '7d', '30d', 'inactive_30d', 'never'])
  return allowed.has(v) ? v : null
}

/**
 * @param {string | null | undefined} raw
 */
export function parseAdminUserSort(raw) {
  const v = String(raw ?? '').trim().toLowerCase()
  const allowed = new Set([
    'created_desc',
    'created_asc',
    'last_login_desc',
    'name_asc',
    'ga_asc',
  ])
  return allowed.has(v) ? v : 'created_desc'
}

/** users 목록·요약 공통 FROM (별칭 u, g, audit_login) */
export const ADMIN_USER_LIST_FROM_SQL = `
  FROM users u
  INNER JOIN ga_companies g ON g.id = u.ga_id
  LEFT JOIN referral_relationships rr ON rr.referred_user_id = u.id
  LEFT JOIN users ref_u ON ref_u.id = rr.referrer_user_id AND ref_u.is_deleted = false
  LEFT JOIN ga_companies ref_g ON ref_g.id = ref_u.ga_id AND ref_g.is_deleted = false
  LEFT JOIN (
    SELECT actor_user_id, MAX(created_at) AS audit_last_login_at
    FROM security_audit_logs
    WHERE action = 'login_success'
    GROUP BY actor_user_id
  ) audit_login ON audit_login.actor_user_id = u.id
  LEFT JOIN billing_subscriptions bs ON bs.user_id = u.id
`

export const ADMIN_USER_EFFECTIVE_LAST_LOGIN_SQL =
  'COALESCE(u.last_login_at, audit_login.audit_last_login_at)'

/**
 * @param {'today' | '7d' | '30d' | 'inactive_30d' | 'never'} activity
 * @param {number} paramIndex 1-based next $ index for bound params
 * @returns {{ clause: string, params: Date[], nextIndex: number }}
 */
export function buildAdminUserActivityClause(activity, paramIndex) {
  const effective = ADMIN_USER_EFFECTIVE_LAST_LOGIN_SQL
  const params = []
  let idx = paramIndex
  if (activity === 'never') {
    return { clause: `AND ${effective} IS NULL`, params, nextIndex: idx }
  }
  const kstDayStartSql = `(date_trunc('day', (now() AT TIME ZONE '${KST}')) AT TIME ZONE '${KST}')`
  if (activity === 'today') {
    return {
      clause: `AND ${effective} IS NOT NULL AND ${effective} >= ${kstDayStartSql}`,
      params,
      nextIndex: idx,
    }
  }
  if (activity === '7d') {
    return {
      clause: `AND ${effective} IS NOT NULL AND ${effective} >= (${kstDayStartSql} - interval '6 days')`,
      params,
      nextIndex: idx,
    }
  }
  if (activity === '30d') {
    return {
      clause: `AND ${effective} IS NOT NULL AND ${effective} >= (${kstDayStartSql} - interval '29 days')`,
      params,
      nextIndex: idx,
    }
  }
  if (activity === 'inactive_30d') {
    return {
      clause: `AND ${effective} IS NOT NULL AND ${effective} < (${kstDayStartSql} - interval '30 days')`,
      params,
      nextIndex: idx,
    }
  }
  return { clause: '', params, nextIndex: idx }
}

/**
 * @param {Date} monthStart
 * @param {Date} monthEnd
 * @param {number} startIndex
 */
export function buildAdminUserMonthlyNewClause(monthStart, monthEnd, startIndex) {
  return {
    clause: `AND u.created_at >= $${startIndex} AND u.created_at < $${startIndex + 1}`,
    params: [monthStart, monthEnd],
    nextIndex: startIndex + 2,
  }
}

/**
 * @param {string} sort
 */
export function buildAdminUserOrderClause(sort) {
  switch (sort) {
    case 'created_asc':
      return 'u.created_at ASC NULLS LAST, u.id ASC'
    case 'last_login_desc':
      return `${ADMIN_USER_EFFECTIVE_LAST_LOGIN_SQL} DESC NULLS LAST, u.created_at DESC NULLS LAST, u.id DESC`
    case 'name_asc':
      return 'COALESCE(NULLIF(TRIM(u.display_name), \'\'), u.username) ASC, u.id ASC'
    case 'ga_asc':
      return 'g.name ASC, u.created_at DESC NULLS LAST, u.id DESC'
    case 'created_desc':
    default:
      return 'u.created_at DESC NULLS LAST, u.id DESC'
  }
}
