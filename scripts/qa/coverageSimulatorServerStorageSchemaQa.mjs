/**
 * DEV DB: verify coverage simulator storage tables/indexes.
 * Requires DATABASE_URL (Railway public Postgres URL).
 */
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL required')

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes('railway') ? { rejectUnauthorized: false } : undefined,
})

const REQUIRED_TEMPLATE = [
  'id',
  'owner_user_id',
  'ga_id',
  'name',
  'description',
  'disease_type',
  'items_json',
  'legacy_client_id',
  'created_at',
  'updated_at',
]
const REQUIRED_SIM = [
  'id',
  'owner_user_id',
  'ga_id',
  'customer_id',
  'title',
  'disease_type',
  'template_id',
  'template_name_snapshot',
  'customer_name_snapshot',
  'consultation_date',
  'items_json',
  'legacy_client_id',
  'created_at',
  'updated_at',
]

async function columnSet(table) {
  const r = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
    `,
    [table],
  )
  return new Set(r.rows.map((row) => row.column_name))
}

async function indexesFor(table) {
  const r = await pool.query(
    `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = $1
    `,
    [table],
  )
  return r.rows
}

async function main() {
  for (const table of ['coverage_scenario_templates', 'coverage_simulations']) {
    const exists = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`])
    if (!exists.rows[0]?.reg) {
      console.error(`[FAIL] missing table ${table}`)
      process.exit(1)
    }
    console.log(`[PASS] table ${table}`)
  }

  const tCols = await columnSet('coverage_scenario_templates')
  for (const col of REQUIRED_TEMPLATE) {
    if (!tCols.has(col)) {
      console.error(`[FAIL] coverage_scenario_templates missing column ${col}`)
      process.exit(1)
    }
  }
  console.log('[PASS] coverage_scenario_templates columns')

  const sCols = await columnSet('coverage_simulations')
  for (const col of REQUIRED_SIM) {
    if (!sCols.has(col)) {
      console.error(`[FAIL] coverage_simulations missing column ${col}`)
      process.exit(1)
    }
  }
  console.log('[PASS] coverage_simulations columns')

  const tIdx = await indexesFor('coverage_scenario_templates')
  const legacyTemplateIdx = tIdx.find((row) => row.indexname.includes('legacy'))
  if (!legacyTemplateIdx?.indexdef?.includes('legacy_client_id')) {
    console.error('[FAIL] template legacy index missing')
    process.exit(1)
  }
  if (!legacyTemplateIdx.indexdef.includes('WHERE')) {
    console.error('[FAIL] template legacy index should be partial unique')
    process.exit(1)
  }
  console.log('[PASS] template legacy partial unique index')

  const sIdx = await indexesFor('coverage_simulations')
  const legacySimIdx = sIdx.find((row) => row.indexname.includes('legacy'))
  if (!legacySimIdx) {
    console.error('[FAIL] simulation legacy index missing')
    process.exit(1)
  }
  console.log('[PASS] simulation legacy partial unique index')

  const gaNullable = await pool.query(
    `
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_name = 'coverage_scenario_templates' AND column_name = 'ga_id'
    `,
  )
  if (gaNullable.rows[0]?.is_nullable === 'YES') {
    console.warn('[WARN] ga_id is nullable — tenant queries must not rely on = NULL')
  } else {
    console.log('[PASS] ga_id NOT NULL on templates')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => pool.end())
