/** @typedef {'all'|'login'|'user'|'notice'|'contract'|'billing'|'system'|'other'} AuditLogCategory */

const ACTION_LABELS = Object.freeze({
  login_success: '로그인 성공',
  login_failed: '로그인 실패',
  LOGIN_FAILED: '로그인 실패',
  logout: '로그아웃',
  password_reset: '비밀번호 초기화',
  user_create: '사용자 생성',
  user_update: '사용자 수정',
  user_delete: '사용자 삭제',
  role_update: '권한 변경',
  notice_create: '공지 작성',
  notice_update: '공지 수정',
  notice_publish: '공지 게시',
  notice_archive: '공지 보관',
  contract_template_delete: '전자서명 템플릿 삭제',
  contract_send_session_delete: '전자서명 발송내역 삭제',
  billing_update: '결제 정보 변경',
  promotion_code_create: '쿠폰 생성',
  FORBIDDEN_ACCESS: '접근 거부',
  HARD_DELETE_COMPANY: '보험사 영구 삭제',
  insurer_manager_create: '원수사 담당자 등록',
  insurer_manager_update: '원수사 담당자 수정',
  insurer_manager_deactivate: '원수사 담당자 비활성화',
  insurer_manager_delete: '원수사 담당자 삭제',
  loss_adjuster_create: '손해사정사 등록',
  loss_adjuster_update: '손해사정사 수정',
  loss_adjuster_delete: '손해사정사 삭제',
  PLATFORM_INDUSTRY_CREATE: '플랫폼 업종 생성',
  PLATFORM_INDUSTRY_ADMIN_ASSIGN: '플랫폼 업종 관리자 지정',
  PLATFORM_TENANT_CREATE: '테넌트 생성',
  PLATFORM_TENANT_ADMIN_ASSIGN: '테넌트 관리자 지정',
  PLATFORM_TENANT_MEMBER_ASSIGN: '테넌트 멤버 지정',
  PLATFORM_TENANT_USER_CREATE: '테넌트 사용자 생성',
  PLATFORM_TENANT_USER_PATCH: '테넌트 사용자 수정',
  PLATFORM_TENANT_USER_STATUS_PATCH: '테넌트 사용자 상태 변경',
  PLATFORM_TENANT_REG_CODE_CREATE: '가입 코드 생성',
  PLATFORM_TENANT_REG_CODE_PATCH: '가입 코드 수정',
  PLATFORM_TENANT_SEAT_BILLING_PATCH: '테넌트 좌석/과금 변경',
})

const ROLE_LABELS = Object.freeze({
  SUPER_ADMIN: '최고관리자',
  GA_ADMIN: 'GA 관리자',
  GA_STAFF: '직원',
  USER: '일반 유저',
  STAFF: '직원',
  INSURER_MANAGER: '원수사 담당자',
  LOSS_ADJUSTER: '손해사정사 담당자',
  anonymous: '익명',
})

const SENSITIVE_META_KEYS = new Set([
  'password',
  'newPassword',
  'oldPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'password_hash',
  'passwordHash',
  'cardNumber',
  'reauthToken',
])

const LOGIN_FAIL_REASON_LABELS = Object.freeze({
  invalid_credentials: '아이디 또는 비밀번호 불일치',
  user_not_found: '존재하지 않는 계정',
  account_inactive: '비활성 계정',
})

const CATEGORY_LOGIN_SQL = `(LOWER(action) LIKE '%login%' OR action = 'LOGIN_FAILED' OR LOWER(action) = 'logout')`
const CATEGORY_USER_SQL = `(
  LOWER(action) LIKE '%user%'
  OR action LIKE 'insurer_manager_%'
  OR action LIKE 'loss_adjuster_%'
  OR action LIKE 'PLATFORM_TENANT_USER%'
  OR action LIKE 'PLATFORM_TENANT_MEMBER%'
  OR action LIKE 'PLATFORM_TENANT_ADMIN%'
)`
const CATEGORY_NOTICE_SQL = `(LOWER(action) LIKE 'notice_%')`
const CATEGORY_CONTRACT_SQL = `(LOWER(action) LIKE '%contract%')`
const CATEGORY_BILLING_SQL = `(
  LOWER(action) LIKE '%billing%'
  OR LOWER(action) LIKE '%promotion%'
  OR LOWER(action) LIKE '%subscription%'
  OR action = 'PLATFORM_TENANT_SEAT_BILLING_PATCH'
)`
const CATEGORY_SYSTEM_SQL = `(
  action LIKE 'PLATFORM_%'
  OR action = 'FORBIDDEN_ACCESS'
  OR action = 'HARD_DELETE_COMPANY'
)`

/** @type {Record<string, string>} */
export const AUDIT_LOG_CATEGORY_SQL = Object.freeze({
  login: CATEGORY_LOGIN_SQL,
  user: CATEGORY_USER_SQL,
  notice: CATEGORY_NOTICE_SQL,
  contract: CATEGORY_CONTRACT_SQL,
  billing: CATEGORY_BILLING_SQL,
  system: CATEGORY_SYSTEM_SQL,
  other: `NOT (
    ${CATEGORY_LOGIN_SQL}
    OR ${CATEGORY_USER_SQL}
    OR ${CATEGORY_NOTICE_SQL}
    OR ${CATEGORY_CONTRACT_SQL}
    OR ${CATEGORY_BILLING_SQL}
    OR ${CATEGORY_SYSTEM_SQL}
  )`,
})

/**
 * @param {string | null | undefined} action
 */
export function resolveAuditLogActionLabel(action) {
  const raw = String(action ?? '').trim()
  if (!raw) {
    return '기타 작업'
  }
  if (ACTION_LABELS[raw]) {
    return ACTION_LABELS[raw]
  }
  const lower = raw.toLowerCase()
  if (ACTION_LABELS[lower]) {
    return ACTION_LABELS[lower]
  }
  return '기타 작업'
}

/**
 * @param {string | null | undefined} role
 */
export function resolveAuditLogRoleLabel(role) {
  const raw = String(role ?? '').trim()
  if (!raw) {
    return '—'
  }
  if (ROLE_LABELS[raw]) {
    return ROLE_LABELS[raw]
  }
  return raw
}

/**
 * @param {string | null | undefined} action
 * @returns {AuditLogCategory}
 */
export function resolveAuditLogCategory(action) {
  const raw = String(action ?? '').trim()
  const lower = raw.toLowerCase()
  if (!raw) {
    return 'other'
  }
  if (lower.includes('login') || raw === 'LOGIN_FAILED' || lower === 'logout') {
    return 'login'
  }
  if (lower.startsWith('notice_')) {
    return 'notice'
  }
  if (lower.includes('contract')) {
    return 'contract'
  }
  if (
    lower.includes('billing') ||
    lower.includes('promotion') ||
    lower.includes('subscription') ||
    raw === 'PLATFORM_TENANT_SEAT_BILLING_PATCH'
  ) {
    return 'billing'
  }
  if (raw.startsWith('PLATFORM_') || raw === 'FORBIDDEN_ACCESS' || raw === 'HARD_DELETE_COMPANY') {
    return 'system'
  }
  if (
    lower.includes('user') ||
    raw.startsWith('insurer_manager_') ||
    raw.startsWith('loss_adjuster_') ||
    raw.startsWith('PLATFORM_TENANT_USER') ||
    raw.startsWith('PLATFORM_TENANT_MEMBER') ||
    raw.startsWith('PLATFORM_TENANT_ADMIN')
  ) {
    return 'user'
  }
  return 'other'
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? '').trim(),
  )
}

function shortenId(value) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return ''
  }
  if (!isUuidLike(raw)) {
    return raw
  }
  return `${raw.slice(0, 8)}…`
}

/**
 * @param {Record<string, unknown> | null | undefined} meta
 * @param {string | null | undefined} actorUserId
 * @param {{ username?: string | null, display_name?: string | null } | null | undefined} joinedUser
 */
export function resolveAuditActorDisplayName(meta, actorUserId, joinedUser) {
  const username = String(joinedUser?.username ?? meta?.username ?? meta?.login_id ?? '').trim()
  const displayName = String(joinedUser?.display_name ?? meta?.name ?? meta?.displayName ?? '').trim()
  const email = String(meta?.email ?? '').trim()

  if (displayName && username && displayName !== username) {
    return `${displayName}(${username})`
  }
  if (username) {
    return username
  }
  if (displayName) {
    return displayName
  }
  if (email) {
    return email
  }
  const actorRaw = String(actorUserId ?? '').trim()
  if (!actorRaw) {
    return '—'
  }
  if (isUuidLike(actorRaw)) {
    return shortenId(actorRaw)
  }
  return actorRaw
}

/**
 * @param {string | null | undefined} targetType
 * @param {string | null | undefined} targetId
 * @param {string | null | undefined} actorRole
 */
export function resolveAuditTargetLabel(targetType, targetId, actorRole) {
  const type = String(targetType ?? '').trim().toLowerCase().replace(/-/g, '_')
  if (!type) {
    return '—'
  }
  if (type === 'auth' || type === 'user') {
    const role = String(actorRole ?? '').trim()
    if (role === 'SUPER_ADMIN' || role === 'GA_ADMIN' || role === 'GA_STAFF') {
      return '관리자 계정'
    }
    if (role === 'anonymous') {
      return '로그인 시도'
    }
    return '사용자 계정'
  }
  if (type === 'notice') {
    return '공지사항'
  }
  if (type === 'contract_template' || type === 'contract-template') {
    return '전자서명 템플릿'
  }
  if (type === 'contract_session' || type === 'contract-session' || type === 'contract_send_session') {
    return '전자서명 발송내역'
  }
  if (type === 'billing') {
    return '결제 정보'
  }
  if (type === 'customer') {
    return '고객'
  }
  if (type === 'insurer_manager') {
    return '원수사 담당자'
  }
  if (type === 'loss_adjuster') {
    return '손해사정사'
  }
  if (type === 'company') {
    return '보험사'
  }
  if (type === 'http') {
    return '시스템 접근'
  }
  if (targetId) {
    return `${type} (${shortenId(targetId)})`
  }
  return type
}

function parseMetaObject(meta) {
  if (meta == null) {
    return {}
  }
  if (typeof meta === 'object' && !Array.isArray(meta)) {
    return meta
  }
  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * @param {string | null | undefined} action
 * @param {unknown} meta
 * @param {string} actionLabel
 * @param {string} actorDisplayName
 */
export function buildAuditLogSummary(action, meta, actionLabel, actorDisplayName) {
  const m = parseMetaObject(meta)
  const raw = String(action ?? '').trim()
  const lower = raw.toLowerCase()

  if (lower === 'login_success') {
    const who = String(m.username ?? actorDisplayName ?? '').trim()
    return who ? `${who} 계정으로 로그인` : '로그인 성공'
  }
  if (raw === 'LOGIN_FAILED' || lower === 'login_failed') {
    const who = String(m.username ?? actorDisplayName ?? '알 수 없는 계정').trim()
    const reasonKey = String(m.reason ?? m.code ?? '').trim()
    const reasonLabel = LOGIN_FAIL_REASON_LABELS[reasonKey] ?? (reasonKey || '')
    return reasonLabel ? `${who} 로그인 실패 (${reasonLabel})` : `${who} 로그인 실패`
  }
  if (lower === 'logout') {
    const who = String(m.username ?? actorDisplayName ?? '').trim()
    return who ? `${who} 로그아웃` : '로그아웃'
  }
  if (m.noticeTitle) {
    return `${String(m.noticeTitle)} 공지 관련 작업`
  }
  if (m.templateName || m.template_name) {
    return `${String(m.templateName ?? m.template_name)} 템플릿 관련 작업`
  }
  if (m.companyName) {
    return `${String(m.companyName)} 관련 작업`
  }
  if (m.username && (lower.includes('create') || lower.includes('update') || lower.includes('delete'))) {
    return `${String(m.username)} — ${actionLabel}`
  }
  if (raw === 'FORBIDDEN_ACCESS' && m.path) {
    return `권한 없는 접근: ${String(m.path)}`
  }
  if (actionLabel !== '기타 작업') {
    return actionLabel
  }
  return '—'
}

/**
 * @param {unknown} value
 * @param {string} [key]
 */
export function maskSensitiveAuditMeta(value, key = '') {
  if (key && SENSITIVE_META_KEYS.has(key)) {
    return '***'
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => maskSensitiveAuditMeta(item, String(index)))
  }
  if (value && typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = maskSensitiveAuditMeta(v, k)
    }
    return out
  }
  return value
}

/**
 * @param {Record<string, unknown>} row
 */
export function enrichSecurityAuditLogRow(row) {
  const meta = parseMetaObject(row.meta)
  const action = String(row.action ?? '')
  const actionLabel = resolveAuditLogActionLabel(action)
  const actorDisplayName = resolveAuditActorDisplayName(meta, row.actor_user_id, {
    username: row.actor_username,
    display_name: row.actor_display_name,
  })
  const targetRaw =
    row.target_type != null
      ? `${String(row.target_type)}:${String(row.target_id ?? '')}`
      : null

  return {
    id: row.id,
    occurredAt: row.created_at,
    created_at: row.created_at,
    action,
    actionLabel,
    category: resolveAuditLogCategory(action),
    actorUserId: row.actor_user_id,
    actorUsername: row.actor_username ?? (typeof meta.username === 'string' ? meta.username : null),
    actorDisplayName,
    role: row.actor_role,
    roleLabel: resolveAuditLogRoleLabel(row.actor_role),
    target: targetRaw,
    target_type: row.target_type,
    target_id: row.target_id,
    targetLabel: resolveAuditTargetLabel(row.target_type, row.target_id, row.actor_role),
    gaId: row.ga_id,
    ga_id: row.ga_id,
    company_id: row.company_id,
    summary: buildAuditLogSummary(action, meta, actionLabel, actorDisplayName),
    meta: maskSensitiveAuditMeta(meta),
    metaRaw: meta,
    ipAddress: typeof meta.ip === 'string' ? meta.ip : typeof meta.ipAddress === 'string' ? meta.ipAddress : null,
    userAgent:
      typeof meta.userAgent === 'string'
        ? meta.userAgent
        : typeof meta.user_agent === 'string'
          ? meta.user_agent
          : null,
  }
}
