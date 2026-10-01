/**
 * 고객 주소 지역 컬럼 백필.
 * 기본은 dry-run 이다. 원문 address 는 수정하지 않는다.
 *
 *   node server/scripts/runAddressRegionBackfill.mjs
 *   node server/scripts/runAddressRegionBackfill.mjs --apply
 */
import pool from '../db.js'
import {
  ADDRESS_REGION_BACKFILL_COUNT_SQL,
  runAddressRegionBackfill,
} from '../customers/addressRegionBackfill.js'

const apply = process.argv.includes('--apply')

const counts = await pool.query(ADDRESS_REGION_BACKFILL_COUNT_SQL)
const summary = await runAddressRegionBackfill(pool, { apply })
console.log(JSON.stringify({ counts: counts.rows[0], summary: { ...summary, updates: summary.updates.length } }, null, 2))
await pool.end()
