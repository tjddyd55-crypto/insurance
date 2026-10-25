/**
 * 관리자 사용자 상세 — 접속 채널·기기 (t527).
 * - 권한: 호출부 가드(requireSuperAdminOrScopedGaAdmin) + 여기서 forcedGaId 로 GA 범위 재확인.
 * - IP 는 반환하지 않는다.
 */
import { CLIENT_TYPES } from '../../shared/clientAccessContext.js'

export const ADMIN_USER_ACCESS_HISTORY_LIMIT = 20

function iso(v) {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function str(v) {
  return v != null && String(v).trim() ? String(v) : null
}

/**
 * @param {{ query: Function }} pool
 * @param {{ userId: string, forcedGaId: number | null }} args forcedGaId=null 은 SUPER_ADMIN(전체)
 */
export async function loadAdminUserAccessContext(pool, { userId, forcedGaId }) {
  const uid = String(userId ?? '').trim()
  if (!uid) return null
  const u = await pool.query(
    `
    SELECT u.id, u.created_at, u.last_login_at, u.last_seen_at,
           u.first_client_type, u.last_client_type, u.last_device_model, u.last_app_version
    FROM users u
    WHERE u.id = $1 AND u.is_deleted = false
      AND ($2::int IS NULL OR u.ga_id = $2::int)
    `,
    [uid, forcedGaId ?? null],
  )
  const row = u.rows[0]
  if (!row) return null
  const h = await pool.query(
    `
    SELECT created_at, client_type, platform, device_model, app_version
    FROM user_auth_sessions
    WHERE user_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT $2
    `,
    [uid, ADMIN_USER_ACCESS_HISTORY_LIMIT],
  )
  const c = await pool.query(
    `
    SELECT DISTINCT client_type
    FROM user_auth_sessions
    WHERE user_id = $1 AND client_type IS NOT NULL
    `,
    [uid],
  )
  const used = new Set(c.rows.map((r) => String(r.client_type)))
  if (row.last_client_type) used.add(String(row.last_client_type))
  if (row.first_client_type) used.add(String(row.first_client_type))
  return {
    userId: String(row.id),
    createdAt: iso(row.created_at),
    lastLoginAt: iso(row.last_login_at),
    lastSeenAt: iso(row.last_seen_at),
    firstClientType: str(row.first_client_type),
    lastClientType: str(row.last_client_type),
    lastDeviceModel: str(row.last_device_model),
    lastAppVersion: str(row.last_app_version),
    usedClientTypes: CLIENT_TYPES.filter((t) => used.has(t)),
    recentSessions: h.rows.map((r) => ({
      at: iso(r.created_at),
      clientType: str(r.client_type),
      platform: str(r.platform),
      deviceModel: str(r.device_model),
      appVersion: str(r.app_version),
    })),
  }
}
