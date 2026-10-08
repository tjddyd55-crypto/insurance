/**
 * Development only: remove customer_custom_fields rows with label '주력보험사'.
 * Usage: railway run --environment development --service app node server/scripts/dev-remove-primary-insurer-custom-fields.mjs [--execute]
 */
import pg from 'pg'

const LABEL = '주력보험사'
const execute = process.argv.includes('--execute')

async function main() {
  const target = String(process.env.INSURANCE_DB_ENVIRONMENT ?? '').trim().toLowerCase()
  if (target === 'production') {
    console.error('[dev-remove-primary-insurer] production DB blocked')
    process.exit(1)
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const before = await pool.query(
      `SELECT COUNT(*)::int AS n FROM customer_custom_fields WHERE TRIM(label) = $1`,
      [LABEL],
    )
    const countBefore = before.rows[0]?.n ?? 0
    console.log(`count_before=${countBefore}`)
    if (!execute) {
      console.log('dry_run=1 (pass --execute to delete)')
      return
    }
    const del = await pool.query(
      `DELETE FROM customer_custom_fields WHERE TRIM(label) = $1`,
      [LABEL],
    )
    console.log(`removed=${del.rowCount ?? 0}`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
