import { systemQuery } from '../utils/dbSafeQuery.js'
import { parseGaId } from './parseGaId.js'

/**
 * DB 기록용 R2 프리픽스 템플릿 ({environment} 는 리터럴).
 * @param {string} industryCode
 * @param {string} tenantCode
 */
export function buildInsuranceTenantR2KeyPrefix(industryCode, tenantCode) {
  const ic = String(industryCode ?? '').trim() || 'insurance'
  const tc = String(tenantCode ?? '').trim()
  return `crm-platform/{environment}/${ic}/tenants/${tc}`
}

/**
 * 테넌트 코드 후보 (GA code 우선, 충돌 시 ga-{id}).
 * @param {string} gaCode
 * @param {number} gaId
 */
export function buildTenantCodeCandidates(gaCode, gaId) {
  const normalized = String(gaCode ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 32)
  const fallback = `GA_${gaId}`
  if (!normalized || normalized.length < 2) {
    return [fallback]
  }
  if (normalized === fallback) {
    return [normalized]
  }
  return [normalized, fallback]
}

/**
 * 보험 산업(insurance) tenants 행을 legacy_ga_id 기준으로 보장한다.
 * 이미 있으면 재사용하고, 없으면 생성한다 (idempotent).
 *
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{
 *   gaId: unknown
 *   gaCode?: unknown
 *   gaName?: unknown
 * }} params
 * @returns {Promise<
 *   | { ok: true; tenantId: number; created: boolean; industryId: number }
 *   | { ok: false; code: string; message: string }
 * >}
 */
export async function ensureInsuranceTenantForLegacyGa(executor, params) {
  const gaId = parseGaId(params.gaId)
  if (gaId == null) {
    return { ok: false, code: 'invalid_ga', message: 'GA ID가 올바르지 않습니다.' }
  }

  const existing = await systemQuery(
    executor,
    `
    SELECT id, industry_id, status
    FROM tenants
    WHERE legacy_ga_id = $1
    ORDER BY
      CASE WHEN LOWER(COALESCE(status::text, 'active')) = 'active' THEN 0 ELSE 1 END,
      id ASC
    LIMIT 2
    `,
    [gaId],
  )

  if ((existing.rowCount ?? 0) > 1) {
    console.error('[ensureInsuranceTenantForLegacyGa] duplicate tenants for legacy_ga_id', {
      gaId,
      count: existing.rowCount,
    })
  }

  const existingRow = existing.rows[0]
  if (existingRow) {
    const tenantId = Number(existingRow.id)
    const industryId = Number(existingRow.industry_id)
    if (Number.isSafeInteger(tenantId) && tenantId > 0) {
      return {
        ok: true,
        tenantId,
        created: false,
        industryId: Number.isSafeInteger(industryId) && industryId > 0 ? industryId : 0,
      }
    }
  }

  const industry = await systemQuery(
    executor,
    `
    SELECT id
    FROM industries
    WHERE code = 'insurance'
      AND LOWER(COALESCE(status::text, 'active')) = 'active'
    ORDER BY id ASC
    LIMIT 1
    `,
  )
  const industryId = Number(industry.rows[0]?.id ?? 0)
  if (!(Number.isSafeInteger(industryId) && industryId > 0)) {
    return {
      ok: false,
      code: 'insurance_industry_missing',
      message: '보험 업종(industry)이 준비되지 않았습니다.',
    }
  }

  let gaCode = typeof params.gaCode === 'string' ? params.gaCode.trim().toUpperCase() : ''
  let gaName = typeof params.gaName === 'string' ? params.gaName.trim() : ''
  if (!gaCode || !gaName) {
    const gaRow = await systemQuery(
      executor,
      `
      SELECT code, name
      FROM ga_companies
      WHERE id = $1
        AND COALESCE(is_deleted, FALSE) IS NOT TRUE
      LIMIT 1
      `,
      [gaId],
    )
    const g0 = gaRow.rows[0]
    if (!g0) {
      return { ok: false, code: 'ga_not_found', message: 'GA를 찾을 수 없습니다.' }
    }
    if (!gaCode) {
      gaCode = String(g0.code ?? '').trim().toUpperCase()
    }
    if (!gaName) {
      gaName = String(g0.name ?? '').trim() || gaCode || `GA ${gaId}`
    }
  }

  const codeCandidates = buildTenantCodeCandidates(gaCode, gaId)
  let lastError = /** @type {Error | null} */ (null)

  for (const tenantCode of codeCandidates) {
    const r2KeyPrefix = buildInsuranceTenantR2KeyPrefix('insurance', tenantCode)
    try {
      const inserted = await systemQuery(
        executor,
        `
        INSERT INTO tenants (
          industry_id,
          code,
          name,
          status,
          legacy_ga_id,
          r2_key_prefix,
          config
        )
        VALUES ($1, $2, $3, 'active', $4, $5, '{}'::jsonb)
        ON CONFLICT (legacy_ga_id) DO UPDATE SET
          updated_at = NOW()
        RETURNING id, industry_id
        `,
        [industryId, tenantCode, gaName || tenantCode, gaId, r2KeyPrefix],
      )
      const row = inserted.rows[0]
      const tenantId = Number(row?.id ?? 0)
      if (Number.isSafeInteger(tenantId) && tenantId > 0) {
        return {
          ok: true,
          tenantId,
          created: true,
          industryId: Number(row.industry_id) || industryId,
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const code = /** @type {{ code?: string }} */ (error)?.code
      // unique code 충돌 → 다음 후보
      if (code === '23505') {
        continue
      }
      throw error
    }
  }

  console.error('[ensureInsuranceTenantForLegacyGa] failed to insert tenant', {
    gaId,
    message: lastError?.message,
  })
  return {
    ok: false,
    code: 'tenant_create_failed',
    message: 'GA 테넌트를 생성하지 못했습니다.',
  }
}
