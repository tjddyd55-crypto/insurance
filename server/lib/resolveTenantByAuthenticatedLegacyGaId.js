import { systemQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from './parseGaId.js'
import { ensureInsuranceTenantForLegacyGa } from './ensureInsuranceTenantForLegacyGa.js'

/**
 * 인증된 사용자의 legacy GA(ga_companies.id)로 tenants 행을 조회한다.
 * req.body.ga_id 등 외부 입력을 신뢰하지 않고 authUser.gaId 와 일치할 때만 허용한다.
 * tenants 가 없으면 보험 industry 기준으로 idempotent 생성 후 재조회한다.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{
 *   legacyGaId: unknown
 *   authUser?: { gaId?: unknown; ga_id?: unknown } | null
 *   ensureIfMissing?: boolean
 * }} params
 * @returns {Promise<
 *   | { ok: true; tenantId: number }
 *   | { ok: false; status: number; code: string; message: string }
 * >}
 */
export async function resolveTenantByAuthenticatedLegacyGaId(executor, params) {
  const authGaId = parseGaId(params.authUser?.gaId ?? params.authUser?.ga_id)
  const requestedGaId = parseGaId(params.legacyGaId)
  const ensureIfMissing = params.ensureIfMissing !== false

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

  const selectTenant = async () =>
    systemQuery(
      executor,
      `
      SELECT id, legacy_ga_id, status
      FROM tenants
      WHERE legacy_ga_id = $1
      ORDER BY
        CASE WHEN LOWER(COALESCE(status::text, 'active')) = 'active' THEN 0 ELSE 1 END,
        id ASC
      LIMIT 2
      `,
      [authGaId],
    )

  let result = await selectTenant()
  if ((result.rowCount ?? 0) > 1) {
    console.error('[resolveTenantByAuthenticatedLegacyGaId] duplicate tenants', {
      gaId: authGaId,
      count: result.rowCount,
    })
  }

  let tenantId = Number(result.rows[0]?.id ?? 0)
  if (!(Number.isSafeInteger(tenantId) && tenantId > 0) && ensureIfMissing) {
    const ensured = await ensureInsuranceTenantForLegacyGa(executor, { gaId: authGaId })
    if (!ensured.ok) {
      return {
        ok: false,
        status: ensured.code === 'ga_not_found' ? 404 : 500,
        code: ensured.code,
        message:
          ensured.code === 'tenant_create_failed' || ensured.code === 'insurance_industry_missing'
            ? '고객을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
            : ensured.message,
      }
    }
    result = await selectTenant()
    tenantId = Number(result.rows[0]?.id ?? ensured.tenantId ?? 0)
  }

  if (!(Number.isSafeInteger(tenantId) && tenantId > 0)) {
    return {
      ok: false,
      status: 404,
      code: 'tenant_not_found',
      message: '연결된 테넌트를 찾을 수 없습니다.',
    }
  }

  const legacyCheck = Number(result.rows[0]?.legacy_ga_id ?? authGaId)
  if (legacyCheck !== authGaId) {
    console.error('[resolveTenantByAuthenticatedLegacyGaId] legacy_ga_id mismatch after resolve', {
      authGaId,
      legacyCheck,
      tenantId,
    })
    return {
      ok: false,
      status: 500,
      code: 'tenant_ga_mismatch',
      message: '고객을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    }
  }

  return { ok: true, tenantId }
}
