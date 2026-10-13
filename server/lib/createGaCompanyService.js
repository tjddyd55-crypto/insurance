import { systemQuery } from '../utils/dbSafeQuery.js'
import { ensureInsuranceTenantForLegacyGa } from './ensureInsuranceTenantForLegacyGa.js'
import { findGaCompanyByNormalizedCode, normalizeGaCompanyCode } from './generalGa.js'
import { parseGaId } from './parseGaId.js'

const CODE_RE = /^[A-Z0-9_]{2,32}$/

/**
 * @param {unknown} code
 */
export function validateGaCompanyCodeFormat(code) {
  const norm = normalizeGaCompanyCode(code)
  if (!norm || !CODE_RE.test(norm)) {
    return {
      ok: false,
      message: 'code는 2~32자의 영문 대문자·숫자·밑줄만 사용할 수 있습니다.',
    }
  }
  return { ok: true, code: norm }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ name: string; code: string }} p
 */
export async function insertGaCompanyRecord(executor, p) {
  const name = String(p.name ?? '').trim()
  const codeCheck = validateGaCompanyCodeFormat(p.code)
  if (!name) {
    throw Object.assign(new Error('name이 필요합니다.'), { statusCode: 400, publicMessage: 'name이 필요합니다.' })
  }
  if (!codeCheck.ok) {
    throw Object.assign(new Error(codeCheck.message), {
      statusCode: 400,
      publicMessage: codeCheck.message,
    })
  }
  const code = codeCheck.code
  const ins = await systemQuery(
    executor,
    `
    INSERT INTO ga_companies (name, code, status, is_deleted)
    VALUES ($1, $2, 'active', false)
    RETURNING id, name, code, status, created_at
    `,
    [name, code],
  )
  const createdGa = ins.rows[0]
  const createdGaId = parseGaId(createdGa?.id)
  if (createdGaId != null) {
    const tenantEnsured = await ensureInsuranceTenantForLegacyGa(executor, {
      gaId: createdGaId,
      gaCode: code,
      gaName: name,
    })
    if (!tenantEnsured.ok) {
      console.error('[insertGaCompanyRecord] tenant provision failed', {
        gaId: createdGaId,
        code: tenantEnsured.code,
      })
    }
  }
  return createdGa
}

/**
 * 지점명 기반 GA 코드 자동 제안(중복 시 숫자 접미사).
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} branchName
 */
export async function proposeUniqueGaCodeForBranchName(executor, branchName) {
  const trimmed = String(branchName ?? '').trim()
  const latin = trimmed
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24)

  let base = latin.length >= 2 ? latin : ''
  if (!base) {
    const idRes = await systemQuery(executor, `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM ga_companies`)
    const nextId = Number(idRes.rows[0]?.next_id ?? 1)
    base = `BR${String(nextId).padStart(4, '0')}`
  }

  for (let i = 0; i < 200; i += 1) {
    const suffix = i === 0 ? '' : `_${i}`
    const candidate = `${base.slice(0, Math.max(2, 32 - suffix.length))}${suffix}`
    const existing = await findGaCompanyByNormalizedCode(executor, candidate)
    if (!existing) {
      return candidate
    }
  }
  throw new Error('GA 코드를 자동 생성하지 못했습니다.')
}
