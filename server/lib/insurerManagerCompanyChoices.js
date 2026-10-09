import { safeQuery, systemQuery } from '../utils/dbSafeQuery.js'
import { resolveInsuranceCategoryForApi } from './insuranceCompanyCategoryResolve.js'
import { normalizeInsuranceCompanyNameKey } from './ensureInsuranceCompanyDirectoryStubs.js'
import { parseGaId } from './parseGaId.js'
import { SEED_DATA } from '../seedInsuranceFullData.js'

/** 원수사 담당자 등록 보험회사 선택 SSOT — 영진(YJASSET) 마스터 목록을 플랫폼 카탈로그로 사용 */
export const INSURER_MANAGER_REFERENCE_GA_CODE = 'YJASSET'

function formatInsCompanyCode(id) {
  return `INS${String(Number(id)).padStart(6, '0')}`
}

/** NOT NULL company_code — GA·유형·이름 기반 멱등 코드 (전역 uq_insurance_company_master_company_code) */
function companyCodeForInsurerManagerGaMaster(gaId, category, name) {
  const g = parseGaId(gaId)
  const cat = category === 'LIFE' ? 'L' : 'N'
  const key =
    normalizeInsuranceCompanyNameKey(name).replace(/[^a-z0-9]/g, '').slice(0, 12) || 'insurer'
  return `IM${String(g)}${cat}${key}`.slice(0, 20)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
async function ensureMasterCompanyCode(executor, masterId, gaId) {
  const tenantGa = parseGaId(gaId)
  if (tenantGa == null) {
    throw new Error('GA 컨텍스트가 없습니다.')
  }
  const masterIdNum = Number(masterId)
  if (!Number.isInteger(masterIdNum) || masterIdNum < 1) {
    return
  }
  const code = formatInsCompanyCode(masterIdNum)
  try {
    await safeQuery(
      executor,
      `
      UPDATE insurance_company_master
      SET company_code = $1
      WHERE id = $2
        AND ga_id = $3
        AND (company_code IS NULL OR TRIM(company_code) = '')
      `,
      [code, masterIdNum, tenantGa],
    )
  } catch (error) {
    if (error && typeof error === 'object' && error.code === '23505') {
      return
    }
    throw error
  }
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

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
async function findGaCompanyMasterIdByName(executor, gaId, category, name) {
  const g = parseGaId(gaId)
  const byName = await safeQuery(
    executor,
    `
    SELECT id, category
    FROM insurance_company_master
    WHERE ga_id = $1 AND TRIM(name) = TRIM($2)
    ORDER BY id ASC
    `,
    [g, name],
  )
  if (byName.rowCount === 0) {
    return null
  }
  const preferred = byName.rows.find((row) => {
    return resolveInsuranceCategoryForApi(row.category, name) === category
  })
  if (preferred) {
    return Number(preferred.id)
  }
  if (byName.rowCount === 1) {
    return Number(byName.rows[0].id)
  }
  return null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function ensureInsurerManagerCompanyMasterForGa(executor, gaId, category, name) {
  const g = parseGaId(gaId)
  const found = await safeQuery(
    executor,
    `
    SELECT id FROM insurance_company_master
    WHERE ga_id = $1 AND category = $2 AND TRIM(name) = TRIM($3)
    LIMIT 1
    `,
    [g, category, name],
  )
  if (found.rowCount > 0) {
    const id = Number(found.rows[0].id)
    await ensureMasterCompanyCode(executor, id, g)
    return id
  }

  const byNameId = await findGaCompanyMasterIdByName(executor, g, category, name)
  if (byNameId != null) {
    await safeQuery(
      executor,
      `
      UPDATE insurance_company_master
      SET category = $1, updated_at = NOW()
      WHERE id = $2 AND ga_id = $3
        AND (category IS DISTINCT FROM $1)
      `,
      [category, byNameId, g],
    )
    await ensureMasterCompanyCode(executor, byNameId, g)
    return byNameId
  }

  const companyCode = companyCodeForInsurerManagerGaMaster(g, category, name)
  let id
  try {
    const ins = await safeQuery(
      executor,
      `
      INSERT INTO insurance_company_master (ga_id, category, name, company_code, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
      `,
      [g, category, name, companyCode],
    )
    if (ins.rowCount === 0) {
      const byCode = await safeQuery(
        executor,
        `SELECT id FROM insurance_company_master WHERE company_code = $1 AND ga_id = $2 LIMIT 1`,
        [companyCode, g],
      )
      if (byCode.rowCount === 0) {
        throw new Error('보험사 마스터를 생성하지 못했습니다.')
      }
      id = Number(byCode.rows[0].id)
    } else {
      id = Number(ins.rows[0].id)
    }
  } catch (error) {
    if (error && typeof error === 'object' && error.code === '23505') {
      const again = await safeQuery(
        executor,
        `
        SELECT id FROM insurance_company_master
        WHERE ga_id = $1 AND category = $2 AND TRIM(name) = TRIM($3)
        LIMIT 1
        `,
        [g, category, name],
      )
      if (again.rowCount > 0) {
        id = Number(again.rows[0].id)
      } else {
        const fallbackId = await findGaCompanyMasterIdByName(executor, g, category, name)
        if (fallbackId == null) {
          throw error
        }
        id = fallbackId
      }
    } else {
      throw error
    }
  }

  await ensureMasterCompanyCode(executor, id, g)
  return id
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
async function resolveGaCompanyMasterIdForCatalogEntry(executor, gaId, category, name) {
  const g = parseGaId(gaId)
  const found = await safeQuery(
    executor,
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
  const byNameId = await findGaCompanyMasterIdByName(executor, g, category, name)
  return byNameId ?? 0
}

/**
 * 플랫폼 카탈로그(영진 마스터) 기준 선택 목록. id=0 이면 해당 GA에 master 행 없음(저장 시 ensure).
 * @returns {Promise<Array<{ id: number, name: string, category: 'LIFE' | 'NON_LIFE' }>>}
 */
export async function listInsurerManagerCompanyChoicesForGa(pool, gaId) {
  const g = parseGaId(gaId)
  if (g == null) {
    throw new Error('GA 컨텍스트가 없습니다.')
  }
  const catalog = await loadPlatformInsurerCompanyCatalog(pool)
  const out = []
  for (const entry of catalog) {
    const id = await resolveGaCompanyMasterIdForCatalogEntry(pool, g, entry.category, entry.name)
    out.push({ id, name: entry.name, category: entry.category })
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return out
}
