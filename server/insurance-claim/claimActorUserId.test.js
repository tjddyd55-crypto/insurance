import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { resolveClaimActorUserId } from '../registerInsuranceClaimCompanyApi.js'

test('resolveClaimActorUserId keeps UUID string ids (no numeric conversion)', () => {
  const uuid = '3f2b9c1e-1111-4a2b-9c3d-abcdefabcdef'
  assert.equal(resolveClaimActorUserId({ user: { id: uuid } }), uuid)
  assert.equal(resolveClaimActorUserId({ user: { id: `  ${uuid} ` } }), uuid)
  assert.equal(resolveClaimActorUserId({ user: { id: '' } }), null)
  assert.equal(resolveClaimActorUserId({}), null)
})

test('claim create/duplicate/delete record actor via string id, not parsePositiveInt', () => {
  const src = readFileSync(new URL('../registerInsuranceClaimCompanyApi.js', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /parsePositiveInt\(req\.user/)
  assert.match(src, /createdBy: resolveClaimActorUserId\(req\)/)
  assert.equal((src.match(/[^n] resolveClaimActorUserId\(req\)|: resolveClaimActorUserId\(req\)/g) ?? []).length, 3)
})

test('initDb declares insurance_claim_requests *_by as TEXT and converts legacy INTEGER', () => {
  const src = readFileSync(new URL('../initDb.js', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /ADD COLUMN IF NOT EXISTS (created|deleted)_by INTEGER NULL/)
  assert.match(src, /ADD COLUMN IF NOT EXISTS created_by TEXT NULL/)
  assert.match(src, /ADD COLUMN IF NOT EXISTS deleted_by TEXT NULL/)
  assert.match(src, /ensureUserIdColumnIsText\(executor, \{\s*tableName: 'insurance_claim_requests',\s*columnNames: \['created_by', 'deleted_by'\]/)
})
