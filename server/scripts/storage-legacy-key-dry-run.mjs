#!/usr/bin/env node
/**
 * storage files row — R2 key 후보 dry-run (DB/R2 변경 없음).
 *
 * Usage:
 *   node server/scripts/storage-legacy-key-dry-run.mjs [--customer-name "장유미"]
 */
import pg from 'pg'
import { collectStorageFileObjectKeyCandidates } from '../lib/storageFileObjectKey.js'
import { isConsentR2Enabled, r2StorageObjectExists } from '../lib/consentStorage.js'

const customerNameArg = (() => {
  const idx = process.argv.indexOf('--customer-name')
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1]
  }
  return '장유미'
})()

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('DATABASE_URL required')
    process.exit(1)
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const cust = await pool.query(
      `
      SELECT id, name
      FROM customers
      WHERE name ILIKE $1
      ORDER BY id DESC
      LIMIT 5
      `,
      [`%${customerNameArg}%`],
    )
    if (cust.rowCount === 0) {
      console.log('No customer matched:', customerNameArg)
      return
    }
    console.log('Customers:', cust.rows)

    for (const c of cust.rows) {
      const files = await pool.query(
        `
        SELECT id, display_name, original_name, file_path, file_size, mime_type, created_at
        FROM files
        WHERE customer_id = $1
          AND deleted_at IS NULL
          AND status = 'active'
        ORDER BY created_at ASC
        `,
        [c.id],
      )
      console.log('\n===', c.name, `(id=${c.id})`, `files=${files.rowCount} ===`)
      for (const f of files.rows) {
        const candidates = collectStorageFileObjectKeyCandidates(f.file_path)
        /** @type {{ key: string; exists: boolean | null }[]} */
        const checks = []
        if (isConsentR2Enabled()) {
          for (const key of candidates) {
            try {
              const exists = await r2StorageObjectExists(key)
              checks.push({ key, exists })
            } catch (e) {
              checks.push({ key, exists: null })
            }
          }
        }
        const hit = checks.find((x) => x.exists === true)
        console.log({
          id: f.id,
          displayName: f.display_name,
          createdAt: f.created_at,
          filePath: f.file_path,
          recoverable: Boolean(hit),
          winningKey: hit?.key ?? null,
          candidateCount: candidates.length,
          checks: checks.slice(0, 6),
        })
      }
    }
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
