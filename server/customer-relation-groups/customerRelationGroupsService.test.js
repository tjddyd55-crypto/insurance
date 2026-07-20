import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_RELATIONSHIP_LABELS,
  normalizeGroupType,
  normalizeRelationshipLabel,
} from './customerRelationGroupsService.js'

describe('customer relation groups helpers', () => {
  it('normalizes group types with FAMILY default', () => {
    assert.equal(normalizeGroupType('family'), 'FAMILY')
    assert.equal(normalizeGroupType('BUSINESS'), 'BUSINESS')
    assert.equal(normalizeGroupType('unknown'), 'FAMILY')
    assert.equal(normalizeGroupType(null), 'FAMILY')
  })

  it('normalizes relationship labels', () => {
    assert.equal(normalizeRelationshipLabel(' 배우자 '), '배우자')
    assert.equal(normalizeRelationshipLabel('', '본인'), '본인')
    assert.equal(normalizeRelationshipLabel('x'.repeat(50)).length, 40)
  })

  it('exposes default relationship labels including 본인', () => {
    assert.ok(DEFAULT_RELATIONSHIP_LABELS.includes('본인'))
    assert.ok(DEFAULT_RELATIONSHIP_LABELS.includes('배우자'))
    assert.ok(DEFAULT_RELATIONSHIP_LABELS.includes('자녀'))
  })
})
