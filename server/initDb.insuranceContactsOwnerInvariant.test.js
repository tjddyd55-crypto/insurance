import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const INIT_DB_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'initDb.js')
const initDbSource = fs.readFileSync(INIT_DB_PATH, 'utf8')

function insuranceContactsBlock() {
  const start = initDbSource.indexOf('CREATE TABLE IF NOT EXISTS insurance_contacts')
  assert.ok(start >= 0, 'insurance_contacts block missing')
  const end = initDbSource.indexOf('CREATE TABLE IF NOT EXISTS insurance_contact_updates', start)
  assert.ok(end > start, 'insurance_contact_updates block missing')
  return initDbSource.slice(start, end)
}

describe('initDb insurance_contacts owner invariant', () => {
  it('does not backfill ga_id on all NULL rows (USER contacts must stay ga_id NULL)', () => {
    const block = insuranceContactsBlock()
    assert.doesNotMatch(
      block,
      /WHERE g\.code = 'YJASSET' AND c\.ga_id IS NULL\s*`\)/,
      'must not assign YJASSET ga_id to every row with ga_id IS NULL',
    )
    assert.match(block, /COALESCE\(c\.owner_scope, 'GA'\) = 'GA'/)
    assert.match(block, /c\.user_id IS NULL/)
  })

  it('null ga_id check applies only to GA-scoped rows without user_id', () => {
    const block = insuranceContactsBlock()
    assert.match(block, /COALESCE\(owner_scope, 'GA'\) = 'GA'/)
    assert.match(block, /user_id IS NULL/)
  })

  it('clears ga_id on USER owner_scope rows before invariant constraint', () => {
    const block = insuranceContactsBlock()
    assert.match(
      block,
      /SET ga_id = NULL[\s\S]*WHERE owner_scope = 'USER' AND ga_id IS NOT NULL/,
    )
  })

  it('defines insurance_contacts_owner_invariant CHECK', () => {
    const block = insuranceContactsBlock()
    assert.match(block, /insurance_contacts_owner_invariant/)
    assert.match(block, /owner_scope = 'GA' AND ga_id IS NOT NULL AND user_id IS NULL/)
    assert.match(block, /owner_scope = 'USER' AND user_id IS NOT NULL AND ga_id IS NULL/)
  })
})
