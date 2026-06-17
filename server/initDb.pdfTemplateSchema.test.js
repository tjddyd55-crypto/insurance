import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const DESTRUCTIVE_CUSTOMER_MAPPING_RESET_RE =
  /UPDATE\s+pdf_template_fields\s+SET\s+customer_mapping\s*=\s*NULL/i

const INIT_DB_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'initDb.js')

test('initDb.js must not bulk-reset pdf_template_fields.customer_mapping', () => {
  const source = fs.readFileSync(INIT_DB_PATH, 'utf8')
  assert.equal(
    DESTRUCTIVE_CUSTOMER_MAPPING_RESET_RE.test(source),
    false,
    'ensurePdfTemplateSchema must not wipe saved customer data mappings on server start',
  )
})

test('ensurePdfTemplateSchema does not execute customer_mapping NULL reset', async () => {
  const { ensurePdfTemplateSchema } = await import('./initDb.js')
  const executed = []
  const executor = {
    query: async (sql) => {
      executed.push(String(sql))
      return { rows: [], rowCount: 0 }
    },
  }

  await ensurePdfTemplateSchema(executor)

  const destructive = executed.some((sql) => DESTRUCTIVE_CUSTOMER_MAPPING_RESET_RE.test(sql))
  assert.equal(destructive, false)
})
