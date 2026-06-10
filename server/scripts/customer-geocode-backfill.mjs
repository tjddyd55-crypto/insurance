/**
 * 고객 주소 → 좌표 backfill (기본 dry-run).
 *
 * 사용:
 *   node server/scripts/customer-geocode-backfill.mjs
 *   node server/scripts/customer-geocode-backfill.mjs --dry-run --limit 20
 *   node server/scripts/customer-geocode-backfill.mjs --execute --user-id <uuid> --limit 50
 *   node server/scripts/customer-geocode-backfill.mjs --dry-run --limit 20 --retry-failed
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pool from '../db.js'
import { assertSafeForMutatingScript } from '../lib/dbEnvironmentGuard.js'
import { runCustomerGeocodeBackfill } from '../services/customerGeocodeBackfill.js'

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

function parseArgs(argv) {
  const out = {
    execute: false,
    dryRun: true,
    userId: null,
    limit: 50,
    delayMs: 120,
    retryFailed: false,
  }
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--execute') {
      out.execute = true
      out.dryRun = false
    } else if (arg === '--dry-run') {
      out.execute = false
      out.dryRun = true
    } else if (arg === '--user-id') {
      out.userId = argv[i + 1] ?? null
      i += 1
    } else if (arg === '--limit') {
      out.limit = Number(argv[i + 1] ?? out.limit)
      i += 1
    } else if (arg === '--delay-ms') {
      out.delayMs = Number(argv[i + 1] ?? out.delayMs)
      i += 1
    } else if (arg === '--retry-failed') {
      out.retryFailed = true
    }
  }
  return out
}

async function main() {
  loadEnvFileIfPresent(projectRoot, '.env')
  loadEnvFileIfPresent(path.join(projectRoot, 'server'), '.env')
  loadEnvFileIfPresent(path.join(projectRoot, 'server'), '.env.local')

  const args = parseArgs(process.argv)
  assertSafeForMutatingScript({
    connectionString: process.env.DATABASE_URL,
    execute: args.execute,
    scriptName: 'customer-geocode-backfill',
  })

  console.log('[customer-geocode-backfill] options:', {
    mode: args.execute ? 'execute' : 'dry-run',
    userId: args.userId,
    limit: args.limit,
    delayMs: args.delayMs,
    retryFailed: args.retryFailed,
  })

  const summary = await runCustomerGeocodeBackfill(pool, {
    execute: args.execute,
    userId: args.userId,
    limit: args.limit,
    delayMs: args.delayMs,
    retryFailed: args.retryFailed,
  })

  console.log('[customer-geocode-backfill] summary:', summary)
  await pool.end()
}

main().catch((err) => {
  console.error('[customer-geocode-backfill] failed:', err)
  process.exit(1)
})
