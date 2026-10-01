import { systemQuery } from '../utils/dbSafeQuery.js'
import { buildCustomerConsultationSummaryJoin } from '../lib/customerConsultationListQuery.js'

const OWNER_SQL = `
  c.ga_id = $1
  AND c.deleted_at IS NULL
  AND COALESCE(c.owner_user_id, c.user_id) = $2
`

/**
 * @param {string} raw
 */
function escapeLike(raw) {
  return raw.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * @param {string} sort
 * @param {string} userPlaceholder
 * @param {string} gaPlaceholder
 */
function orderBy(sort) {
  if (sort === 'created') {
    return 'c.created_at DESC, c.id DESC'
  }
  if (sort === 'consult') {
    return 'lc.last_consult_date DESC NULLS LAST, c.created_at DESC, c.id DESC'
  }
  return 'c.name ASC, c.id ASC'
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ userId: string, gaId: number, sido?: string, sigungu?: string }} scope
 */
export async function loadCustomerRegionOptions(pool, scope) {
  const sido = String(scope.sido ?? '').trim()
  const sigungu = String(scope.sigungu ?? '').trim()
  const sidoRows = await systemQuery(
    pool,
    `
    SELECT DISTINCT c.address_sido AS value
    FROM customers c
    WHERE ${OWNER_SQL}
      AND c.address_sido IS NOT NULL
      AND btrim(c.address_sido) <> ''
    ORDER BY value
    `,
    [scope.gaId, scope.userId],
  )
  const sigunguRows = sido
    ? await systemQuery(
        pool,
        `
        SELECT DISTINCT c.address_sigungu AS value
        FROM customers c
        WHERE ${OWNER_SQL}
          AND c.address_sido = $3
          AND c.address_sigungu IS NOT NULL
          AND btrim(c.address_sigungu) <> ''
        ORDER BY value
        `,
        [scope.gaId, scope.userId, sido],
      )
    : { rows: [] }
  const dongRows = sido && (sigungu || sigunguRows.rows.length === 0)
    ? await systemQuery(
        pool,
        `
        SELECT DISTINCT c.address_eupmyeondong AS value
        FROM customers c
        WHERE ${OWNER_SQL}
          AND c.address_sido = $3
          AND ($4::text = '' OR c.address_sigungu = $4)
          AND c.address_eupmyeondong IS NOT NULL
          AND btrim(c.address_eupmyeondong) <> ''
        ORDER BY value
        `,
        [scope.gaId, scope.userId, sido, sigungu],
      )
    : { rows: [] }
  return {
    sido: sidoRows.rows.map((row) => String(row.value)),
    sigungu: sigunguRows.rows.map((row) => String(row.value)),
    eupmyeondong: dongRows.rows.map((row) => String(row.value)),
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{
 *   userId: string,
 *   gaId: number,
 *   sido?: string,
 *   sigungu?: string,
 *   eupmyeondong?: string,
 *   query?: string,
 *   sort?: string,
 * }} scope
 */
export async function loadCustomerRegionList(pool, scope) {
  const sort = ['name', 'created', 'consult'].includes(scope.sort ?? '') ? scope.sort : 'name'
  const keyword = String(scope.query ?? '').trim()
  const digits = keyword.replace(/\D/g, '')
  const params = [
    scope.gaId,
    scope.userId,
    String(scope.sido ?? '').trim(),
    String(scope.sigungu ?? '').trim(),
    String(scope.eupmyeondong ?? '').trim(),
    keyword ? `%${escapeLike(keyword)}%` : '',
    digits ? `%${digits}%` : '',
  ]
  const consultJoin = buildCustomerConsultationSummaryJoin('$2', '$1')
  const result = await systemQuery(
    pool,
    `
    SELECT c.id, c.name, c.phone, c.address,
           c.address_sido, c.address_sigungu, c.address_eupmyeondong,
           c.created_at, lc.last_consult_date,
           COALESCE(u.display_name, u.username, '') AS assignee_name,
           COALESCE(labels.labels, '') AS labels
    FROM customers c
    LEFT JOIN users u ON u.id = COALESCE(c.owner_user_id, c.user_id)
    ${consultJoin}
    LEFT JOIN LATERAL (
      SELECT string_agg(cf.label, ', ' ORDER BY cf.sort_order, cf.id) AS labels
      FROM customer_custom_fields cf
      WHERE cf.customer_id = c.id
        AND cf.user_id = $2
        AND cf.ga_id = $1
        AND cf.deleted_at IS NULL
        AND btrim(cf.label) <> ''
    ) labels ON TRUE
    WHERE ${OWNER_SQL}
      AND ($3::text = '' OR c.address_sido = $3)
      AND ($4::text = '' OR c.address_sigungu = $4)
      AND ($5::text = '' OR c.address_eupmyeondong = $5)
      AND (
        $6::text = ''
        OR c.name ILIKE $6 ESCAPE '\\'
        OR c.address ILIKE $6 ESCAPE '\\'
        OR c.phone ILIKE $6 ESCAPE '\\'
        OR ($7::text <> '' AND regexp_replace(c.phone, '\\D', '', 'g') LIKE $7)
      )
    ORDER BY ${orderBy(sort)}
    LIMIT 300
    `,
    params,
  )
  return result.rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name ?? ''),
    phone: String(row.phone ?? ''),
    address: String(row.address ?? ''),
    addressSido: row.address_sido ?? null,
    addressSigungu: row.address_sigungu ?? null,
    addressEupmyeondong: row.address_eupmyeondong ?? null,
    assigneeName: String(row.assignee_name ?? ''),
    labels: String(row.labels ?? ''),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    lastConsultDate: row.last_consult_date ? String(row.last_consult_date).slice(0, 10) : null,
  }))
}
