import { systemQuery } from '../utils/dbSafeQuery.js'

/** 시스템 기본 공용 GA 코드(저장·비교용 대문자) */
export const GENERAL_GA_CODE_CANONICAL = 'GENERAL'

/** initDb 자동 생성 시 기본 표시명 */
export const GENERAL_GA_DISPLAY_NAME = '공용'

/**
 * GA 회사 코드 정규화 — 대소문자·공백 무시 비교용.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeGaCompanyCode(raw) {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isGeneralGaCompanyCode(raw) {
  return normalizeGaCompanyCode(raw) === GENERAL_GA_CODE_CANONICAL
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} codeNorm — normalizeGaCompanyCode 결과
 * @returns {Promise<{ id: number; name: string; code: string; status: string } | null>}
 */
export async function findGaCompanyByNormalizedCode(executor, codeNorm) {
  const norm = normalizeGaCompanyCode(codeNorm)
  if (!norm) {
    return null
  }
  const r = await systemQuery(
    executor,
    `
    SELECT id, name, code, status
    FROM ga_companies
    WHERE UPPER(TRIM(code)) = $1 AND is_deleted = false
    ORDER BY id ASC
    LIMIT 1
    `,
    [norm],
  )
  const row = r.rows[0]
  if (!row) {
    return null
  }
  const id = Number(row.id)
  if (!Number.isInteger(id) || id < 1) {
    return null
  }
  return {
    id,
    name: String(row.name ?? '').trim(),
    code: String(row.code ?? '').trim(),
    status: String(row.status ?? 'active').trim(),
  }
}

/**
 * 가입·SMS 인증용: 코드가 비어 있으면 GENERAL, 있으면 활성 GA 조회.
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {unknown} inviteRaw
 * @returns {Promise<{ id: number; codeNormalized: string; name: string }>}
 */
export async function resolveSignupGaCompany(executor, inviteRaw) {
  const codeNorm = normalizeGaCompanyCode(inviteRaw)
  if (!codeNorm) {
    const general = await ensureGeneralGaCompany(executor)
    return {
      id: general.id,
      codeNormalized: normalizeGaCompanyCode(general.code),
      name: general.name,
    }
  }
  if (isGeneralGaCompanyCode(codeNorm)) {
    const general = await ensureGeneralGaCompany(executor)
    return {
      id: general.id,
      codeNormalized: normalizeGaCompanyCode(general.code),
      name: general.name,
    }
  }
  const row = await findGaCompanyByNormalizedCode(executor, codeNorm)
  if (!row) {
    const err = new Error('invalid_ga_code')
    err.code = 'invalid_ga_code'
    throw err
  }
  if (String(row.status ?? '').toLowerCase() !== 'active') {
    const err = new Error('inactive_ga')
    err.code = 'inactive_ga'
    throw err
  }
  return {
    id: row.id,
    codeNormalized: normalizeGaCompanyCode(row.code),
    name: row.name,
  }
}

/**
 * GENERAL GA 행이 없으면 생성한다. 이미 있으면(대소문자 무관) 그 행을 반환한다.
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @returns {Promise<{ id: number; name: string; code: string; status: string }>}
 */
export async function ensureGeneralGaCompany(executor) {
  const existing = await findGaCompanyByNormalizedCode(executor, GENERAL_GA_CODE_CANONICAL)
  if (existing) {
    return existing
  }

  const ins = await systemQuery(
    executor,
    `
    INSERT INTO ga_companies (name, code, status)
    VALUES ($1, $2, 'active')
    ON CONFLICT (code) DO UPDATE
      SET name = EXCLUDED.name,
          status = 'active',
          is_deleted = false
    RETURNING id, name, code, status
    `,
    [GENERAL_GA_DISPLAY_NAME, GENERAL_GA_CODE_CANONICAL],
  )
  const row = ins.rows[0]
  const id = Number(row?.id)
  if (!Number.isInteger(id) || id < 1) {
    throw new Error('[generalGa] GENERAL GA 생성 실패')
  }
  return {
    id,
    name: String(row.name ?? GENERAL_GA_DISPLAY_NAME).trim(),
    code: String(row.code ?? GENERAL_GA_CODE_CANONICAL).trim(),
    status: String(row.status ?? 'active').trim(),
  }
}
