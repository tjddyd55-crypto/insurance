import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const INIT_DB_PATH = join(dirname(fileURLToPath(import.meta.url)), 'initDb.js')
const initDbSource = readFileSync(INIT_DB_PATH, 'utf8')

const ownerScopeIdx = initDbSource.indexOf('ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE')
const gaBackfillIdx = initDbSource.indexOf("WHERE g.code = 'YJASSET'\n      AND c.owner_scope = 'GA'")

describe('initDb insurance_contacts owner invariant', () => {
  it('adds owner_scope and user_id before GA ga_id backfill', () => {
    assert.ok(ownerScopeIdx >= 0, 'owner_scope column migration missing')
    assert.ok(gaBackfillIdx >= 0, 'scoped GA ga_id backfill missing')
    assert.ok(ownerScopeIdx < gaBackfillIdx, 'owner columns must exist before ga_id backfill')
  })

  it('does not backfill ga_id for all rows with ga_id IS NULL only', () => {
    assert.doesNotMatch(
      initDbSource,
      /UPDATE insurance_contacts c[\s\S]{0,220}WHERE g\.code = 'YJASSET' AND c\.ga_id IS NULL\s*\)/,
    )
  })

  it('clears ga_id on USER rows before adding owner invariant', () => {
    const repairIdx = initDbSource.indexOf(
      "WHERE owner_scope = 'USER' AND ga_id IS NOT NULL",
    )
    const invariantIdx = initDbSource.indexOf('insurance_contacts_owner_invariant')
    assert.ok(repairIdx >= 0)
    assert.ok(invariantIdx >= 0)
    assert.ok(repairIdx < invariantIdx)
  })

  it('keeps owner invariant check constraint definition', () => {
    assert.match(
      initDbSource,
      /owner_scope = 'GA' AND ga_id IS NOT NULL AND user_id IS NULL/,
    )
    assert.match(
      initDbSource,
      /owner_scope = 'USER' AND user_id IS NOT NULL AND ga_id IS NULL/,
    )
  })
})
