/**
 * customer_locations / customers 좌표 현황 read-only 조회.
 *
 *   node server/scripts/customer-geocode-stats.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pool from '../db.js'
import { logMaskedDbFingerprint } from '../lib/dbEnvironmentGuard.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')

function loadEnvFileIfPresent(root, filename = '.env') {
  const p = path.join(root, filename)
  if (!fs.existsSync(p)) {
    return
  }
  const raw = fs.readFileSync(p, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) {
      continue
    }
    const i = t.indexOf('=')
    if (i === -1) {
      continue
    }
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = val
    }
  }
}

async function main() {
  loadEnvFileIfPresent(projectRoot, '.env')
  loadEnvFileIfPresent(path.join(projectRoot, 'server'), '.env')
  loadEnvFileIfPresent(path.join(projectRoot, 'server'), '.env.local')

  logMaskedDbFingerprint('[customer-geocode-stats]', process.env.DATABASE_URL)

  const result = await pool.query(`
    SELECT
      COUNT(*)::integer AS total_customers,
      COUNT(*) FILTER (
        WHERE cl.status = 'success'
          AND cl.latitude IS NOT NULL
          AND cl.longitude IS NOT NULL
      )::integer AS with_coords,
      COUNT(*) FILTER (
        WHERE cl.status IS DISTINCT FROM 'success'
          OR cl.latitude IS NULL
          OR cl.longitude IS NULL
          OR cl.id IS NULL
      )::integer AS without_coords,
      COUNT(*) FILTER (
        WHERE COALESCE(TRIM(c.address), '') = ''
          OR cl.status = 'skipped_no_address'
      )::integer AS without_address,
      COUNT(*) FILTER (
        WHERE COALESCE(TRIM(c.address), '') <> ''
          AND (
            cl.id IS NULL
            OR cl.status IS DISTINCT FROM 'success'
            OR cl.latitude IS NULL
            OR cl.longitude IS NULL
          )
      )::integer AS with_address_without_coords,
      COUNT(*) FILTER (WHERE cl.status = 'success')::integer AS status_success,
      COUNT(*) FILTER (WHERE cl.status = 'failed')::integer AS status_failed,
      COUNT(*) FILTER (WHERE cl.status = 'skipped_no_address')::integer AS status_missing_address,
      COUNT(*) FILTER (WHERE cl.status = 'pending')::integer AS status_pending,
      COUNT(*) FILTER (WHERE cl.status = 'stale')::integer AS status_stale,
      COUNT(*) FILTER (WHERE cl.id IS NULL)::integer AS status_no_row
    FROM customers c
    LEFT JOIN customer_locations cl ON cl.customer_id = c.id
    WHERE c.deleted_at IS NULL
  `)

  console.log('[customer-geocode-stats] summary:', result.rows[0])
  await pool.end()
}

main().catch((err) => {
  console.error('[customer-geocode-stats] failed:', err)
  process.exit(1)
})
