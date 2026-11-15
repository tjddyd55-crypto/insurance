// Explicit official-file import only. No bundled KCD/medication data; configurable CSV/XLSX columns.
// Usage: HEALTHWAY_IMPORT_DATABASE_URL=... node scripts/healthway/import-master.mjs kcd|medication file.xlsx mapping.json --apply
import fs from 'node:fs/promises'
import XLSX from 'xlsx'
import pg from 'pg'
import { normalizeKcd } from '../../server/healthway/kcd.js'
const [kind, filename, mappingFile, flag] = process.argv.slice(2)
if (!['kcd', 'medication'].includes(kind) || !filename || !mappingFile) throw new Error('Usage: import-master.mjs kcd|medication FILE MAPPING_JSON [--apply]')
const config = JSON.parse(await fs.readFile(mappingFile, 'utf8'))
if (!config.source || !config.version || !config.columns) throw new Error('Official source, version and column mapping required')
const workbook = XLSX.read(await fs.readFile(filename), { type: 'buffer', raw: true })
const sheet = workbook.Sheets[config.sheet || workbook.SheetNames[0]]
// raw:false / text input prevents loss of drug-code leading zeroes (official CSV must contain text codes).
const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' })
const get = (row, field) => String(row[config.columns[field]] ?? '').trim()
const items = rows.map((row) => {
  const code = get(row, 'code_raw'), name = get(row, kind === 'kcd' ? 'korean_name' : 'name')
  if (!code || !name) throw new Error('Missing official code/name; import aborted')
  if (kind === 'kcd') return [code, normalizeKcd(code), name, get(row, 'parent_code') || null, get(row, 'disease_group') || null, config.version, config.source]
  const system = get(row, 'code_system') || config.codeSystem
  if (!system) throw new Error('Official drug code system required')
  return [code, system, name, get(row, 'ingredient_code') || null, get(row, 'ingredient_name') || null, get(row, 'class_code') || null, get(row, 'class_name') || null, config.version, config.source]
})
if (flag !== '--apply') { console.log(`Validated ${items.length} official rows. No data imported; use --apply with a dedicated DB URL.`); process.exit(0) }
if (!process.env.HEALTHWAY_IMPORT_DATABASE_URL) throw new Error('HEALTHWAY_IMPORT_DATABASE_URL required (no default DB)')
const pool = new pg.Pool({ connectionString: process.env.HEALTHWAY_IMPORT_DATABASE_URL }), db = await pool.connect()
try {
  await db.query('BEGIN')
  const sql = kind === 'kcd' ? `INSERT INTO disease_code_master(code_raw,code_normalized,korean_name,parent_code,disease_group,version,source) VALUES($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(code_normalized,version) DO UPDATE SET korean_name=EXCLUDED.korean_name,parent_code=EXCLUDED.parent_code,disease_group=EXCLUDED.disease_group,source=EXCLUDED.source,active=true` :
    `INSERT INTO medication_master(code_raw,code_system,name,ingredient_code,ingredient_name,class_code,class_name,version,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT(code_raw,code_system,version) DO UPDATE SET name=EXCLUDED.name,ingredient_code=EXCLUDED.ingredient_code,ingredient_name=EXCLUDED.ingredient_name,class_code=EXCLUDED.class_code,class_name=EXCLUDED.class_name,source=EXCLUDED.source,active=true`
  for (const values of items) await db.query(sql, values)
  await db.query('COMMIT'); console.log(`Imported ${items.length} official rows.`)
} catch { await db.query('ROLLBACK'); throw new Error('Official master import failed; transaction rolled back (details withheld)') }
finally { db.release(); await pool.end() }
