/**
 * Contract guards for CustomerRelationsStrip — avoids ReferenceError regressions
 * and keeps legacy 1:1 relations separate from family groups.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const stripPath = join(dir, '../../src/features/customers/components/CustomerRelationsStrip.tsx')
const legacyPath = join(
  dir,
  '../../src/features/customers/components/LegacyCustomerRelationsSection.tsx',
)
const groupsPath = join(
  dir,
  '../../src/features/customers/components/CustomerRelationGroupsSection.tsx',
)
const apiPath = join(dir, '../../src/features/customers/api/customerExtraApi.ts')

const strip = readFileSync(stripPath, 'utf8')
const legacy = readFileSync(legacyPath, 'utf8')
const groups = readFileSync(groupsPath, 'utf8')
const api = readFileSync(apiPath, 'utf8')

test('strip composes Legacy and Groups sections without mixing APIs', () => {
  assert.match(strip, /LegacyCustomerRelationsSection/)
  assert.match(strip, /CustomerRelationGroupsSection/)
  assert.equal(strip.includes('createCustomerRelation('), false)
  assert.equal(strip.includes('createCustomerRelationGroup('), false)
})

test('onOpenCustomer is a required Props field on strip', () => {
  assert.match(strip, /onOpenCustomer:\s*\(id:\s*number,\s*name\?:\s*string\)\s*=>\s*void/)
})

test('legacy link uses createCustomerRelation(token, customerId, relatedCustomerId:number)', () => {
  assert.match(
    legacy,
    /await createCustomerRelation\(\s*token,\s*customerId,\s*relatedCustomerId\s*\)/,
  )
  assert.equal(legacy.includes('{ relatedCustomerId:'), false)
  assert.equal(legacy.includes('createCustomerRelationGroup'), false)
  assert.equal(legacy.includes('가족 그룹을 권장'), false)
})

test('legacy modal title remains 고객 검색 후 연결', () => {
  assert.match(legacy, /고객 검색 후 연결/)
  assert.match(legacy, /related-list--pc/)
})

test('legacy chip click uses onOpenCustomer prop', () => {
  assert.match(legacy, /onOpenCustomer\(r\.relatedCustomerId,\s*r\.relatedName\)/)
})

test('groups section does not call legacy relations POST', () => {
  assert.equal(groups.includes('createCustomerRelation('), false)
  assert.match(groups, /createCustomerRelationGroup/)
  assert.match(groups, /CustomerRelationLabelField/)
})

test('group member click uses onOpenCustomer prop', () => {
  assert.match(groups, /onOpenCustomer\(m\.customerId,\s*m\.name\)/)
})

test('customerExtraApi createCustomerRelation body is { relatedCustomerId }', () => {
  assert.match(api, /JSON\.stringify\(\{\s*relatedCustomerId\s*\}\)/)
  assert.match(
    api,
    /export async function createCustomerRelation\(\s*token:\s*string,\s*customerId:\s*number,\s*relatedCustomerId:\s*number,/,
  )
})
