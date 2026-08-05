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
 * 푸본현대생명(Fubon Hyundai Life) 표기 변형.
 * `푸본생명`은 해외 법인 혼동 위험이 있어 alias에 넣지 않는다.
 */
const FUBON_HYUNDAI_LIFE_NAME_KEYS = new Set([
  '푸본현대생명',
  '푸본현대',
  '푸본현대생명보험',
  '현대라이프',
  '현대라이프생명',
  'fubonhyundailife',
  'fubonhyundai',
])

/**
 * @param {string | null | undefined} name
 */
export function isFubonHyundaiLifeCompanyName(name) {
  const key = normalizeInsuranceCompanyNameKey(name)
  if (!key) {
    return false
  }
  return FUBON_HYUNDAI_LIFE_NAME_KEYS.has(key)
}

/**
 * 고객센터 `1577-3311` — 공식 홈페이지(https://www.fubonhyundai.com/) HTML에서 확인.
 * 업무별 팩스·세부 번호는 미확인으로 비워 둔다.
 */
export const FUBON_HYUNDAI_LIFE_DIRECTORY_STUB = {
  category: /** @type {InsuranceCategory} */ ('LIFE'),
  name: '푸본현대생명',
  /** YJASSET 시드 코드. 다른 GA 는 `companyCodeForFubonGa` 사용 */
  companyCode: 'INS_SEED_011',
  customer_center: '1577-3311',
  system_phone: '',
  incall_number: '',
  visit_info: '',
  contacts: [],
  homepageUrl: 'https://www.fubonhyundai.com/',
}

/**
 * @param {number} gaId
 * @param {number | null | undefined} yjassetGaId
 */
export function companyCodeForFubonGa(gaId, yjassetGaId = null) {
  if (yjassetGaId != null && Number(gaId) === Number(yjassetGaId)) {
    return FUBON_HYUNDAI_LIFE_DIRECTORY_STUB.companyCode
  }
  return `INS_FHL_${Number(gaId)}`.slice(0, 20)
}

/**
 * YJASSET 및 활성 GA 원수사 디렉터리에 stub 회사를 멱등 보장합니다.
 * @param {import('pg').Pool} pool
 */
export async function ensureInsuranceCompanyDirectoryStubs(pool) {
  const gaRes = await systemQuery(
    pool,
    `
    SELECT id, code
    FROM ga_companies
    WHERE COALESCE(is_deleted, false) = false
    ORDER BY id ASC
    `,
  )
  if (gaRes.rowCount === 0) {
    return
  }

  const yjasset = gaRes.rows.find((row) => String(row.code ?? '').trim().toUpperCase() === 'YJASSET')
  const yjassetGaId = yjasset?.id != null ? Number(yjasset.id) : null

  if (yjassetGaId != null) {
    await ensureChubbLifeDirectoryEntry(pool, yjassetGaId)
  }

  for (const row of gaRes.rows) {
    const gaId = Number(row.id)
    if (!Number.isInteger(gaId) || gaId < 1) {
      continue
    }
    await ensureFubonHyundaiLifeDirectoryEntry(pool, gaId, yjassetGaId)
  }

  await ensureFubonHyundaiLifeInsurerSiteUrls(pool)
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

/**
 * @param {import('pg').Pool} pool
 * @param {number} gaId
 * @param {number | null} yjassetGaId
 */
async function ensureFubonHyundaiLifeDirectoryEntry(pool, gaId, yjassetGaId) {
  const stub = FUBON_HYUNDAI_LIFE_DIRECTORY_STUB
  const companyCode = companyCodeForFubonGa(gaId, yjassetGaId)

  const existing = await systemQuery(
    pool,
    `
    SELECT id, name, company_code, category, customer_center
    FROM insurance_company_master
    WHERE ga_id = $1
    ORDER BY id
    `,
    [gaId],
  )

  const fubonRows = existing.rows.filter((row) => isFubonHyundaiLifeCompanyName(row.name))
  if (fubonRows.length > 0) {
    const keep = fubonRows[0]
    const sets = []
    const vals = []
    if (String(keep.name ?? '').trim() !== stub.name) {
      vals.push(stub.name)
      sets.push(`name = $${vals.length}`)
    }
    if (String(keep.category ?? '').trim() !== stub.category) {
      vals.push(stub.category)
      sets.push(`category = $${vals.length}`)
    }
    // 사용자/관리자가 고객센터를 비워 둔 경우에만 공식 번호로 보정. 이미 값이 있으면 덮어쓰지 않음.
    if (!String(keep.customer_center ?? '').trim() && stub.customer_center) {
      vals.push(stub.customer_center)
      sets.push(`customer_center = $${vals.length}`)
    }
    if (sets.length > 0) {
      vals.push(keep.id)
      await systemQuery(
        pool,
        `UPDATE insurance_company_master SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`,
        vals,
      )
    }
    // 같은 GA 내 구 표기 중복 row 는 이름만 canonical 로 맞추고 삭제하지 않는다(참조 ID 보존).
    for (const extra of fubonRows.slice(1)) {
      if (String(extra.name ?? '').trim() !== stub.name) {
        await systemQuery(
          pool,
          `UPDATE insurance_company_master SET name = $1, category = $2, updated_at = NOW() WHERE id = $3`,
          [stub.name, stub.category, extra.id],
        )
      }
    }
    return
  }

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
      companyCode,
    ],
  )

  if (inserted.rowCount === 0) {
    const byCode = await systemQuery(
      pool,
      `SELECT id, name, ga_id FROM insurance_company_master WHERE company_code = $1 LIMIT 1`,
      [companyCode],
    )
    const row = byCode.rows[0]
    if (row && Number(row.ga_id) === Number(gaId) && !isFubonHyundaiLifeCompanyName(row.name)) {
      await systemQuery(
        pool,
        `
        UPDATE insurance_company_master
        SET name = $1, category = $2, customer_center = COALESCE(NULLIF(TRIM(customer_center), ''), $3),
            updated_at = NOW()
        WHERE id = $4
        `,
        [stub.name, stub.category, stub.customer_center, row.id],
      )
    }
  }
}

/**
 * 설계사이트에 이미 있는 푸본현대생명의 구 도메인을 공식 홈으로 보정한다.
 * 관리자가 다른 URL 로 바꾼 경우(구 도메인이 아닐 때)는 덮어쓰지 않는다.
 *
 * @param {import('pg').Pool} pool
 */
async function ensureFubonHyundaiLifeInsurerSiteUrls(pool) {
  const homepage = FUBON_HYUNDAI_LIFE_DIRECTORY_STUB.homepageUrl
  await systemQuery(
    pool,
    `
    UPDATE insurer_sites
    SET
      homepage_url = CASE
        WHEN TRIM(COALESCE(homepage_url, '')) = ''
          OR homepage_url ILIKE '%fubonhyundailife%'
        THEN $1
        ELSE homepage_url
      END,
      sales_url = CASE
        WHEN TRIM(COALESCE(sales_url, '')) = ''
          OR sales_url ILIKE '%fubonhyundailife%'
        THEN $1
        ELSE sales_url
      END,
      claim_url = CASE
        WHEN TRIM(COALESCE(claim_url, '')) = ''
          OR claim_url ILIKE '%fubonhyundailife%'
        THEN $1
        ELSE claim_url
      END,
      updated_at = NOW()
    WHERE name = $2
    `,
    [homepage, FUBON_HYUNDAI_LIFE_DIRECTORY_STUB.name],
  )
}
