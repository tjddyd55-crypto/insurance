import { systemQuery } from '../utils/dbSafeQuery.js'

/** @typedef {'LIFE' | 'NON_LIFE' | 'GENERAL'} InsuranceCategory */

/**
 * @param {string | null | undefined} name
 */
export function normalizeInsuranceCompanyNameKey(name) {
  return String(name ?? '')
    .trim()
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/** 처브생명(Chubb Life) 표기 변형 — 동일 원수사로 취급 */
const CHUBB_LIFE_NAME_KEYS = new Set([
  '처브생명',
  '처브라이프',
  '처브라이프생명',
  'chubblife',
])

/**
 * @param {string | null | undefined} name
 */
export function isChubbLifeCompanyName(name) {
  const key = normalizeInsuranceCompanyNameKey(name)
  if (!key) {
    return false
  }
  return CHUBB_LIFE_NAME_KEYS.has(key)
}

/** @type {{ category: InsuranceCategory, name: string, companyCode: string, customer_center: string, system_phone: string, incall_number: string, visit_info: string, contacts: [] }} */
export const CHUBB_LIFE_DIRECTORY_STUB = {
  category: 'LIFE',
  name: '처브생명',
  companyCode: 'INS_SEED_010',
  customer_center: '',
  system_phone: '',
  incall_number: '',
  visit_info: '',
  contacts: [],
}

/**
 * YJASSET GA 원수사 디렉터리에 처브생명이 없으면 추가하고, 구 표기는 canonical name 으로 정리합니다.
 * @param {import('pg').Pool} pool
 */
export async function ensureInsuranceCompanyDirectoryStubs(pool) {
  const gaRes = await systemQuery(
    pool,
    `SELECT id FROM ga_companies WHERE code = 'YJASSET' LIMIT 1`,
  )
  const gaId = gaRes.rows[0]?.id
  if (gaId == null) {
    return
  }

  await ensureChubbLifeDirectoryEntry(pool, Number(gaId))
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} gaId
 */
async function ensureChubbLifeDirectoryEntry(pool, gaId) {
  const existing = await systemQuery(
    pool,
    `
    SELECT id, name, company_code, category
    FROM insurance_company_master
    WHERE ga_id = $1
    ORDER BY id
    `,
    [gaId],
  )

  const chubbRows = existing.rows.filter((row) => isChubbLifeCompanyName(row.name))
  if (chubbRows.length > 0) {
    const keep = chubbRows[0]
    if (String(keep.name ?? '').trim() !== CHUBB_LIFE_DIRECTORY_STUB.name) {
      await systemQuery(
        pool,
        `UPDATE insurance_company_master SET name = $1, category = $2, updated_at = NOW() WHERE id = $3`,
        [CHUBB_LIFE_DIRECTORY_STUB.name, CHUBB_LIFE_DIRECTORY_STUB.category, keep.id],
      )
    } else if (String(keep.category ?? '').trim() !== CHUBB_LIFE_DIRECTORY_STUB.category) {
      await systemQuery(
        pool,
        `UPDATE insurance_company_master SET category = $1, updated_at = NOW() WHERE id = $2`,
        [CHUBB_LIFE_DIRECTORY_STUB.category, keep.id],
      )
    }
    return
  }

  const stub = CHUBB_LIFE_DIRECTORY_STUB
  const inserted = await systemQuery(
    pool,
    `
    INSERT INTO insurance_company_master (
      ga_id,
      category,
      name,
      customer_center,
      system_phone,
      incall_number,
      visit_info,
      company_code
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (company_code) DO NOTHING
    RETURNING id
    `,
    [
      gaId,
      stub.category,
      stub.name,
      stub.customer_center,
      stub.system_phone,
      stub.incall_number,
      stub.visit_info,
      stub.companyCode,
    ],
  )

  if (inserted.rowCount === 0) {
    const byCode = await systemQuery(
      pool,
      `SELECT id, name FROM insurance_company_master WHERE company_code = $1 LIMIT 1`,
      [stub.companyCode],
    )
    const row = byCode.rows[0]
    if (row && !isChubbLifeCompanyName(row.name)) {
      await systemQuery(
        pool,
        `UPDATE insurance_company_master SET name = $1, category = $2, updated_at = NOW() WHERE id = $3`,
        [stub.name, stub.category, row.id],
      )
    }
  }
}
