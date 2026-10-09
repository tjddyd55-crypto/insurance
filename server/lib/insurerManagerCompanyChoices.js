import { safeQuery, systemQuery } from '../utils/dbSafeQuery.js'
import { resolveInsuranceCategoryForApi } from './insuranceCompanyCategoryResolve.js'
import { parseGaId } from './parseGaId.js'
import { SEED_DATA } from '../seedInsuranceFullData.js'

/** 원수사 담당자 등록 보험회사 선택 SSOT — 영진(YJASSET) 마스터 목록을 플랫폼 카탈로그로 사용 */
export const INSURER_MANAGER_REFERENCE_GA_CODE = 'YJASSET'

function formatInsCompanyCode(id) {
  return `INS${String(Number(id)).padStart(6, '0')}`
}

async function ensureMasterCompanyCode(client, masterId, gaId) {
  const tenantGa = parseGaId(gaId)
  if (tenantGa == null) {
    throw new Error('GA 컨텍스트가 없습니다.')
  }
  const masterIdNum = Number(masterId)
  await safeQuery(
    client,
    `
    UPDATE insurance_company_master
    SET company_code = $1
    WHERE id = $2
      AND ga_id = $3
      AND (company_code IS NULL OR TRIM(company_code) = '')
    `,
    [formatInsCompanyCode(masterIdNum), masterIdNum, tenantGa],
  )
}

/**
 * @returns {Promise<Array<{ category: string, name: string }>>}
 */
async function loadPlatformInsurerCompanyCatalog(pool) {
  const yjRes = await systemQuery(
    pool,
    `
    SELECT id FROM ga_companies
    WHERE UPPER(TRIM(code)) = $1 AND COALESCE(is_deleted, false) = false
    LIMIT 1
    `,
    [INSURER_MANAGER_REFERENCE_GA_CODE],
  )
  if (yjRes.rowCount > 0) {
    const yjGaId = Number(yjRes.rows[0].id)
    const rows = await safeQuery(
      pool,
      `
      SELECT category, name
      FROM insurance_company_master
      WHERE ga_id = $1
      ORDER BY name ASC NULLS LAST, id ASC
      `,
      [yjGaId],
    )
    const seen = new Set()
    const catalog = []
    for (const row of rows.rows) {
      const name = String(row.name ?? '').trim()
      if (!name) {
        continue
      }
      const category = resolveInsuranceCategoryForApi(row.category, name)
      if (category !== 'LIFE' && category !== 'NON_LIFE') {
        continue
      }
      const key = `${category}\0${name}`
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      catalog.push({ category, name })
    }
    if (catalog.length > 0) {
      return catalog
    }
  }

  const seen = new Set()
  const fallback = []
  for (const item of SEED_DATA) {
    const co = item.company
    const name = String(co?.name ?? '').trim()
    if (!name) {
      continue
    }
    const category = resolveInsuranceCategoryForApi(co?.category, name)
    if (category !== 'LIFE' && category !== 'NON_LIFE') {
      continue
    }
    const key = `${category}\0${name}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    fallback.push({ category, name })
  }
  return fallback
}

async function ensureGaCompanyMasterRow(client, gaId, category, name) {
  const g = parseGaId(gaId)
  const found = await safeQuery(
    client,
    `
    SELECT id FROM insurance_company_master
    WHERE ga_id = $1 AND category = $2 AND TRIM(name) = TRIM($3)
    LIMIT 1
    `,
    [g, category, name],
  )
  if (found.rowCount > 0) {
    return Number(found.rows[0].id)
  }
  const ins = await safeQuery(
    client,
    `
    INSERT INTO insurance_company_master (ga_id, category, name, updated_at)
    VALUES ($1, $2, $3, NOW())
    RETURNING id
    `,
    [g, category, name],
  )
  const id = Number(ins.rows[0].id)
  await ensureMasterCompanyCode(client, id, g)
  return id
}

/**
 * 플랫폼 카탈로그(영진 마스터) 기준 선택 목록 + 요청 GA에 master 행 보장.
 * @returns {Promise<Array<{ id: number, name: string, category: 'LIFE' | 'NON_LIFE' }>>}
 */
export async function listInsurerManagerCompanyChoicesForGa(pool, gaId) {
  const g = parseGaId(gaId)
  if (g == null) {
    throw new Error('GA 컨텍스트가 없습니다.')
  }
  const catalog = await loadPlatformInsurerCompanyCatalog(pool)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const out = []
    for (const entry of catalog) {
      const id = await ensureGaCompanyMasterRow(client, g, entry.category, entry.name)
      out.push({ id, name: entry.name, category: entry.category })
    }
    await client.query('COMMIT')
    out.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    return out
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw e
  } finally {
    client.release()
  }
}
