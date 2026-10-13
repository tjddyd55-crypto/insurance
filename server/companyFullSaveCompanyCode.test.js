import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('/company/full-save new master INSERT sets company_code (NOT NULL in initDb)', () => {
  const src = readFileSync(new URL('./index.js', import.meta.url), 'utf8')
  const start = src.indexOf("apiRouter.post('/company/full-save'")
  assert.ok(start > 0)
  const body = src.slice(start, start + 12000)
  const idx = body.indexOf('INSERT INTO insurance_company_master (')
  assert.ok(idx > 0)
  const stmt = body.slice(idx, body.indexOf('RETURNING id', idx))
  assert.match(stmt, /company_code/)
  assert.match(body.slice(idx - 300, idx), /pg_get_serial_sequence\('insurance_company_master', 'id'\)/)
})
