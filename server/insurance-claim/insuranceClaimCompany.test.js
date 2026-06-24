import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeCompanyType,
  normalizeDocumentType,
} from '../insurance-claim/repository/insuranceClaimCompanyRepo.js'

test('normalizeCompanyType: 허용 타입', () => {
  assert.equal(normalizeCompanyType('life'), 'life')
  assert.equal(normalizeCompanyType('non_life'), 'non_life')
  assert.equal(normalizeCompanyType('mutual'), 'mutual')
  assert.equal(normalizeCompanyType('other'), 'other')
})

test('normalizeCompanyType: 잘못된 값', () => {
  assert.equal(normalizeCompanyType('invalid'), null)
})

test('normalizeDocumentType: 허용 타입', () => {
  assert.equal(normalizeDocumentType('claim_form'), 'claim_form')
  assert.equal(normalizeDocumentType('consent_form'), 'consent_form')
  assert.equal(normalizeDocumentType('extra_form'), 'extra_form')
})

test('normalizeDocumentType: 잘못된 값', () => {
  assert.equal(normalizeDocumentType('pdf_template'), null)
})
