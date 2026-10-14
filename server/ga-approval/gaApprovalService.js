/**
 * t291 — 제휴 GA 소속 가입 승인 요청.
 *
 * 원칙
 * - 승인 요청(ga_membership_approval_requests)과 실제 소속(users.ga_id + user_memberships)은 분리.
 * - PENDING 요청의 ga_id 는 절대 소속으로 취급하지 않는다(신청자는 공용 GENERAL GA 에 머문다).
 * - 승인은 단일 트랜잭션 + 행 잠금(FOR UPDATE)으로 중복/동시 승인 방지.
 * - 상태 변화는 ga_membership_approval_events 에 감사 이력으로 남긴다.
 */
import { systemQuery } from '../utils/dbSafeQuery.js'
import { GENERAL_GA_CODE_CANONICAL } from '../lib/generalGa.js'

export const GA_APPROVAL_STATUSES = /** @type {const} */ (['PENDING', 'APPROVED', 'REJECTED'])

/** @param {import('pg').Pool | import('pg').PoolClient} executor */
export async function ensureGaApprovalSchema(executor) {
  await executor.query(`
    ALTER TABLE ga_companies
    ADD COLUMN IF NOT EXISTS accepts_partner_signup BOOLEAN NOT NULL DEFAULT false
  `)
  /** t291b: 기본 OFF — 이후 생성 GA 기본값 false */
  await executor.query(`ALTER TABLE ga_companies ALTER COLUMN accepts_partner_signup SET DEFAULT false`)
  /**
   * t291b 1회성 마이그레이션(사용자 지시): 기존 GA 전부 '가입 신청 허용' OFF.
   * 마커 테이블로 단 한 번만 실행 — 이후 관리자가 켠 값을 재부팅 시 덮어쓰지 않는다.
   * 소속·신청·이력 데이터는 건드리지 않음.
   */
  await executor.query(`
    CREATE TABLE IF NOT EXISTS ga_approval_one_time_migrations (
      key TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      affected_rows INTEGER
    )
  `)
  const marker = await executor.query(
    `INSERT INTO ga_approval_one_time_migrations (key) VALUES ('t291b_partner_signup_default_off')
     ON CONFLICT (key) DO NOTHING RETURNING key`,
  )
  if (marker.rowCount > 0) {
    const upd = await executor.query(
      `UPDATE ga_companies SET accepts_partner_signup = false WHERE accepts_partner_signup = true`,
    )
    await executor.query(
      `UPDATE ga_approval_one_time_migrations SET affected_rows = $1 WHERE key = 't291b_partner_signup_default_off'`,
      [upd.rowCount],
    )
    console.log(`[initDb] t291b accepts_partner_signup → false (${upd.rowCount} GA)`)
  }
  await executor.query(`
    CREATE TABLE IF NOT EXISTS ga_membership_approval_requests (
      id BIGSERIAL PRIMARY KEY,
      applicant_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ga_id INTEGER NOT NULL REFERENCES ga_companies(id),
      status TEXT NOT NULL DEFAULT 'PENDING',
      referrer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      source TEXT NOT NULL DEFAULT 'signup',
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      processed_at TIMESTAMPTZ,
      reject_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT ga_membership_approval_requests_status_check
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
    )
  `)
  await executor.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_ga_membership_approval_pending_applicant
    ON ga_membership_approval_requests (applicant_user_id)
    WHERE status = 'PENDING'
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_ga_membership_approval_ga_status
    ON ga_membership_approval_requests (ga_id, status, requested_at DESC)
  `)
  await executor.query(`
    CREATE TABLE IF NOT EXISTS ga_membership_approval_events (
      id BIGSERIAL PRIMARY KEY,
      request_id BIGINT NOT NULL REFERENCES ga_membership_approval_requests(id) ON DELETE CASCADE,
      ga_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      actor_user_id TEXT,
      actor_role TEXT,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await executor.query(`
    CREATE INDEX IF NOT EXISTS idx_ga_membership_approval_events_request
    ON ga_membership_approval_events (request_id, created_at)
  `)
}

/**
 * 가입 가능한 제휴 GA (활성·미삭제·GENERAL 제외·accepts_partner_signup).
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {number} gaId
 */
export async function findPartnerSignupGa(executor, gaId) {
  if (!Number.isInteger(gaId) || gaId < 1) return null
  const r = await systemQuery(
    executor,
    `
    SELECT id, name, code
    FROM ga_companies
    WHERE id = $1
      AND is_deleted = false
      AND LOWER(TRIM(status)) = 'active'
      AND accepts_partner_signup = true
      AND UPPER(TRIM(code)) <> $2
    LIMIT 1
    `,
    [gaId, GENERAL_GA_CODE_CANONICAL],
  )
  const row = r.rows[0]
  return row ? { id: Number(row.id), name: String(row.name ?? '').trim() } : null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} q
 */
export async function searchPartnerSignupGas(executor, q) {
  const term = String(q ?? '').trim().slice(0, 50)
  const r = await systemQuery(
    executor,
    `
    SELECT id, name
    FROM ga_companies
    WHERE is_deleted = false
      AND LOWER(TRIM(status)) = 'active'
      AND accepts_partner_signup = true
      AND UPPER(TRIM(code)) <> $1
      AND ($2 = '' OR name ILIKE '%' || $2 || '%')
    ORDER BY name ASC, id ASC
    LIMIT 30
    `,
    [GENERAL_GA_CODE_CANONICAL, term],
  )
  return r.rows.map((row) => ({ id: Number(row.id), name: String(row.name ?? '').trim() }))
}

/**
 * 가입 트랜잭션 안에서 PENDING 요청 생성.
 * @param {import('pg').PoolClient} client
 * @param {{ applicantUserId: string; gaId: number; referrerUserId?: string | null }} input
 */
export async function createPendingApprovalRequest(client, input) {
  const ins = await systemQuery(
    client,
    `
    INSERT INTO ga_membership_approval_requests (applicant_user_id, ga_id, status, referrer_user_id, source)
    VALUES ($1, $2, 'PENDING', $3, 'signup')
    RETURNING id
    `,
    [input.applicantUserId, input.gaId, input.referrerUserId || null],
  )
  const requestId = Number(ins.rows[0].id)
  await systemQuery(
    client,
    `
    INSERT INTO ga_membership_approval_events (request_id, ga_id, action, actor_user_id, actor_role)
    VALUES ($1, $2, 'REQUESTED', $3, 'APPLICANT')
    `,
    [requestId, input.gaId, input.applicantUserId],
  )
  return requestId
}

/** @param {any} row */
function mapRequestRow(row) {
  return {
    id: String(row.id),
    status: String(row.status),
    gaId: Number(row.ga_id),
    gaName: row.ga_name != null ? String(row.ga_name) : '',
    applicantUserId: String(row.applicant_user_id),
    applicantUsername: row.applicant_username != null ? String(row.applicant_username) : '',
    applicantName: row.applicant_name != null ? String(row.applicant_name) : '',
    applicantPhone: row.applicant_phone != null ? String(row.applicant_phone) : '',
    referrerName: row.referrer_name != null ? String(row.referrer_name) : '',
    requestedAt: row.requested_at ? new Date(row.requested_at).toISOString() : null,
    processedAt: row.processed_at ? new Date(row.processed_at).toISOString() : null,
    processedByName: row.processed_by_name != null ? String(row.processed_by_name) : '',
    rejectReason: row.reject_reason != null ? String(row.reject_reason) : '',
  }
}

const REQUEST_SELECT_SQL = `
  SELECT r.*, g.name AS ga_name,
         au.username AS applicant_username, au.display_name AS applicant_name, au.phone_number AS applicant_phone,
         ru.display_name AS referrer_name, pu.display_name AS processed_by_name
  FROM ga_membership_approval_requests r
  INNER JOIN ga_companies g ON g.id = r.ga_id
  INNER JOIN users au ON au.id = r.applicant_user_id
  LEFT JOIN users ru ON ru.id = r.referrer_user_id
  LEFT JOIN users pu ON pu.id = r.processed_by_user_id
`

/** 신청자 본인 최신 요청 */
export async function getLatestRequestForApplicant(executor, userId) {
  const r = await systemQuery(
    executor,
    `${REQUEST_SELECT_SQL} WHERE r.applicant_user_id = $1 ORDER BY r.requested_at DESC, r.id DESC LIMIT 1`,
    [String(userId)],
  )
  return r.rows[0] ? mapRequestRow(r.rows[0]) : null
}

/**
 * 관리자 목록. scopeGaId 가 null 이면 전체(SUPER_ADMIN 전용 — 호출부에서 보장).
 * @param {import('pg').Pool} executor
 * @param {{ scopeGaId: number | null; status: string }} opts
 */
export async function listApprovalRequests(executor, opts) {
  const status = GA_APPROVAL_STATUSES.includes(/** @type {any} */ (opts.status)) ? opts.status : 'PENDING'
  const r = await systemQuery(
    executor,
    `${REQUEST_SELECT_SQL}
     WHERE r.status = $1 AND ($2::int IS NULL OR r.ga_id = $2::int)
     ORDER BY COALESCE(r.processed_at, r.requested_at) DESC, r.id DESC
     LIMIT 500`,
    [status, opts.scopeGaId],
  )
  return r.rows.map(mapRequestRow)
}

export async function countPendingRequests(executor, scopeGaId) {
  const r = await systemQuery(
    executor,
    `SELECT COUNT(*)::int AS n FROM ga_membership_approval_requests
     WHERE status = 'PENDING' AND ($1::int IS NULL OR ga_id = $1::int)`,
    [scopeGaId],
  )
  return Number(r.rows[0]?.n ?? 0)
}

export class GaApprovalError extends Error {
  /** @param {number} status @param {string} message @param {string} code */
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

/**
 * 승인/거절 처리 (트랜잭션 + FOR UPDATE).
 * @param {import('pg').Pool} pool
 * @param {{
 *   requestId: number
 *   action: 'APPROVE' | 'REJECT'
 *   actorUserId: string
 *   actorRole: string
 *   actorScopeGaId: number | null  // GA_ADMIN 은 본인 GA, SUPER_ADMIN 은 null
 *   reason?: string
 *   attachMembership: (client: import('pg').PoolClient, p: { userId: string; gaId: number }) => Promise<void>
 * }} input
 */
export async function processApprovalRequest(pool, input) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const reqRes = await systemQuery(
      client,
      `SELECT * FROM ga_membership_approval_requests WHERE id = $1 FOR UPDATE`,
      [input.requestId],
    )
    const reqRow = reqRes.rows[0]
    if (!reqRow) throw new GaApprovalError(404, '승인 요청을 찾을 수 없습니다.', 'not_found')
    const targetGaId = Number(reqRow.ga_id)
    if (input.actorScopeGaId != null && input.actorScopeGaId !== targetGaId) {
      // 다른 GA 요청 존재 여부도 노출하지 않음
      throw new GaApprovalError(404, '승인 요청을 찾을 수 없습니다.', 'other_ga')
    }
    if (String(reqRow.status) !== 'PENDING') {
      throw new GaApprovalError(409, '이미 처리된 요청입니다.', 'already_processed')
    }

    const applicantId = String(reqRow.applicant_user_id)
    if (input.action === 'APPROVE') {
      const ga = await findPartnerSignupGa(client, targetGaId)
      if (!ga) throw new GaApprovalError(400, '해당 GA는 현재 가입 승인을 할 수 없습니다.', 'ga_inactive')
      const uRes = await systemQuery(
        client,
        `
        SELECT u.id, u.role, u.status, u.is_deleted, u.ga_id, g.code AS ga_code
        FROM users u
        LEFT JOIN ga_companies g ON g.id = u.ga_id
        WHERE u.id = $1
        FOR UPDATE OF u
        `,
        [applicantId],
      )
      const u = uRes.rows[0]
      if (!u || u.is_deleted === true || String(u.status ?? 'active').toLowerCase() !== 'active') {
        throw new GaApprovalError(400, '신청자 계정 상태로 인해 승인할 수 없습니다.', 'applicant_inactive')
      }
      if (String(u.role ?? '').toUpperCase() !== 'USER') {
        throw new GaApprovalError(400, '일반 회원만 승인할 수 있습니다.', 'applicant_role')
      }
      const curCode = String(u.ga_code ?? '').trim().toUpperCase()
      if (curCode !== GENERAL_GA_CODE_CANONICAL) {
        // 이미 다른(또는 같은) GA 소속 — 소속 덮어쓰기 금지
        throw new GaApprovalError(409, '신청자가 이미 GA에 소속되어 있어 승인할 수 없습니다.', 'already_member')
      }
      await systemQuery(
        client,
        `UPDATE users SET ga_id = $2 WHERE id = $1 AND ga_id = $3`,
        [applicantId, targetGaId, Number(u.ga_id)],
      )
      await input.attachMembership(client, { userId: applicantId, gaId: targetGaId })
    }

    const newStatus = input.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    const reason = input.action === 'REJECT' ? String(input.reason ?? '').trim().slice(0, 500) : null
    await systemQuery(
      client,
      `
      UPDATE ga_membership_approval_requests
      SET status = $2, processed_by_user_id = $3, processed_at = NOW(), reject_reason = $4, updated_at = NOW()
      WHERE id = $1 AND status = 'PENDING'
      `,
      [input.requestId, newStatus, input.actorUserId, reason],
    )
    await systemQuery(
      client,
      `
      INSERT INTO ga_membership_approval_events (request_id, ga_id, action, actor_user_id, actor_role, note)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [input.requestId, targetGaId, newStatus, input.actorUserId, input.actorRole, reason],
    )
    await client.query('COMMIT')
    return { id: String(input.requestId), status: newStatus, applicantUserId: applicantId, gaId: targetGaId }
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* */
    }
    throw e
  } finally {
    client.release()
  }
}

/**
 * GA 승인 직후, 공용(GENERAL) gaId 를 담은 기존 JWT 로 세션을 재발급할 수 있는지 판정.
 * requireAuth 는 JWT gaId ≠ DB ga_id 이면 401 이므로, 세션 재발급 전용으로만 사용한다.
 * 허용 조건: 토큰 gaId 가 GENERAL GA 이고, DB ga_id 로 APPROVED 된 요청이 존재(USER 한정).
 * @param {import('pg').Pool} executor
 * @param {{ userId: string; tokenGaId: number | null; tokenRole: string }} input
 * @returns {Promise<boolean>}
 */
export async function isApprovedGaTransitionToken(executor, input) {
  if (String(input.tokenRole ?? '').toUpperCase() !== 'USER') return false
  if (input.tokenGaId == null) return false
  const r = await systemQuery(
    executor,
    `
    SELECT 1
    FROM users u
    INNER JOIN ga_companies tg ON tg.id = $2
    INNER JOIN ga_membership_approval_requests ar
      ON ar.applicant_user_id = u.id AND ar.ga_id = u.ga_id AND ar.status = 'APPROVED'
    WHERE u.id = $1
      AND u.is_deleted = false
      AND UPPER(TRIM(u.role)) = 'USER'
      AND u.ga_id <> $2
      AND UPPER(TRIM(tg.code)) = $3
    LIMIT 1
    `,
    [String(input.userId), input.tokenGaId, GENERAL_GA_CODE_CANONICAL],
  )
  return r.rowCount > 0
}
