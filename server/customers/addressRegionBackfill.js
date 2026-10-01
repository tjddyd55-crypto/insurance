import { parseKoreanAddressRegion } from './addressRegion.js'

/**
 * 이미 지역 칸이 채워진 행과 빈 주소는 건너뛴다.
 * 파싱에 성공한 행만 갱신 목록에 넣고, 원문 address 는 포함하지 않는다.
 * @param {Array<{ id: number, address?: string | null, address_sido?: string | null, address_sigungu?: string | null, address_eupmyeondong?: string | null }>} rows
 */
export function summarizeAddressRegionBackfill(rows) {
  let parsed = 0
  let failed = 0
  let skipped = 0
  const updates = []

  for (const row of rows) {
    const hasRegion = Boolean(row.address_sido || row.address_sigungu || row.address_eupmyeondong)
    const address = String(row.address ?? '').trim()
    if (hasRegion || !address) {
      skipped += 1
      continue
    }
    const region = parseKoreanAddressRegion(address)
    const filled = Boolean(region.addressSido || region.addressSigungu || region.addressEupmyeondong)
    if (!filled) {
      failed += 1
      continue
    }
    parsed += 1
    updates.push({
      id: row.id,
      addressSido: region.addressSido,
      addressSigungu: region.addressSigungu,
      addressEupmyeondong: region.addressEupmyeondong,
    })
  }

  return {
    scanned: rows.length,
    parsed,
    failed,
    skipped,
    updates,
  }
}

export const ADDRESS_REGION_BACKFILL_COUNT_SQL = `
SELECT
  COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_customers,
  COUNT(*) FILTER (
    WHERE deleted_at IS NULL
      AND btrim(address) <> ''
      AND address_sido IS NULL
      AND address_sigungu IS NULL
      AND address_eupmyeondong IS NULL
  ) AS pending_backfill,
  COUNT(*) FILTER (
    WHERE deleted_at IS NULL AND address_sido IS NOT NULL
  ) AS with_sido
FROM customers
`

const PENDING_SQL = `
SELECT id, address, address_sido, address_sigungu, address_eupmyeondong
FROM customers
WHERE deleted_at IS NULL
  AND btrim(address) <> ''
  AND address_sido IS NULL
  AND address_sigungu IS NULL
  AND address_eupmyeondong IS NULL
ORDER BY id
`

/**
 * @param {import('pg').Pool | import('pg').PoolClient} pool
 * @param {{ apply?: boolean }} [options]
 */
export async function runAddressRegionBackfill(pool, options = {}) {
  const pending = await pool.query(PENDING_SQL)
  const summary = summarizeAddressRegionBackfill(pending.rows)
  if (!options.apply) {
    return { mode: 'dry-run', ...summary, updated: 0 }
  }

  let updated = 0
  for (const row of summary.updates) {
    const result = await pool.query(
      `
      UPDATE customers
      SET address_sido = $2,
          address_sigungu = $3,
          address_eupmyeondong = $4
      WHERE id = $1
        AND deleted_at IS NULL
        AND address_sido IS NULL
        AND address_sigungu IS NULL
        AND address_eupmyeondong IS NULL
      `,
      [row.id, row.addressSido, row.addressSigungu, row.addressEupmyeondong],
    )
    updated += result.rowCount ?? 0
  }
  return { mode: 'apply', ...summary, updated }
}
