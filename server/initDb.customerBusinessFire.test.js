import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const INIT_DB_PATH = join(dirname(fileURLToPath(import.meta.url)), 'initDb.js')
const initDbSource = readFileSync(INIT_DB_PATH, 'utf8')

describe('initDb customer business / fire insurance schema', () => {
  it('adds nullable business columns on customers with IF NOT EXISTS', () => {
    assert.match(initDbSource, /ADD COLUMN IF NOT EXISTS business_representative_name TEXT NOT NULL DEFAULT ''/)
    assert.match(initDbSource, /ADD COLUMN IF NOT EXISTS business_number TEXT NOT NULL DEFAULT ''/)
    assert.match(initDbSource, /ADD COLUMN IF NOT EXISTS business_address TEXT NOT NULL DEFAULT ''/)
    assert.match(initDbSource, /ADD COLUMN IF NOT EXISTS business_memo TEXT NOT NULL DEFAULT ''/)
  })

  it('creates customer_fire_insurance_locations child table with FK and soft delete', () => {
    assert.match(initDbSource, /CREATE TABLE IF NOT EXISTS customer_fire_insurance_locations/)
    assert.match(initDbSource, /customer_id INTEGER NOT NULL REFERENCES customers\(id\) ON DELETE CASCADE/)
    assert.match(initDbSource, /user_id TEXT NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/)
    assert.match(initDbSource, /ga_id INTEGER NOT NULL REFERENCES ga_companies\(id\) ON DELETE CASCADE/)
    assert.match(initDbSource, /sort_order INTEGER NOT NULL DEFAULT 0/)
    assert.match(initDbSource, /deleted_at TIMESTAMPTZ NULL/)
  })

  it('indexes fire insurance locations for active rows only', () => {
    assert.match(initDbSource, /idx_customer_fire_insurance_locations_customer_id/)
    assert.match(initDbSource, /idx_customer_fire_insurance_locations_user_customer/)
    assert.match(initDbSource, /idx_customer_fire_insurance_locations_ga_customer/)
    assert.match(initDbSource, /WHERE deleted_at IS NULL/)
  })
})
