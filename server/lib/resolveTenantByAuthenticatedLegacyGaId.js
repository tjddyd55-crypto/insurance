import { parseGaId } from './parseGaId.js'
import { systemQuery } from '../utils/dbSafeQuery.js'

/**
 * 인증된 사용자의 legacy GA(ga_companies.id)로 tenants 행을 조회한다.
 * req.body.ga_id 등 외부 입력을 신뢰하지 않고 authUser.gaId 와 일치할 때만 허용한다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{
 *   legacyGaId: unknown
 *   authUser?: { gaId?: unknown; ga_id?: unknown } | null
 * }} params
 * @returns {Promise<
 *   | { ok: true; tenantId: number }
 *   | { ok: false; status: number; code: string; message: string }
 * >}
 */
export async function resolveTenantByAuthenticatedLegacyGaId(executor, params) {
  const authGaId = parseGaId(params.authUser?.gaId ?? params.authUser?.ga_id)
  const requestedGaId = parseGaId(params.legacyGaId)

  if (authGaId == null) {
    return {
      ok: false,
      status: 400,
      code: 'missing_auth_ga',
      message: 'GA 컨텍스트가 없습니다.',
    }
  }

  if (requestedGaId == null || requestedGaId !== authGaId) {
    return {
      ok: false,
      status: 403,
      code: 'ga_mismatch',
      message: '요청 GA와 인증된 GA가 일치하지 않습니다.',
    }
  }

  const result = await systemQuery(
    executor,
    `SELECT id FROM tenants WHERE legacy_ga_id = $1 ORDER BY id ASC LIMIT 1`,
    [authGaId],
  )

  const tenantId = Number(result.rows[0]?.id ?? 0)
  if (!(Number.isSafeInteger(tenantId) && tenantId > 0)) {
    return {
      ok: false,
      status: 404,
      code: 'tenant_not_found',
      message: '연결된 테넌트를 찾을 수 없습니다.',
    }
  }

  return { ok: true, tenantId }
}
