import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildGeneratedDocumentMetadataEntry,
  resolveConsentFormTargets,
  validateConsentFormSignatures,
} from './consentFormGeneration.js'

const baseRequest = {
  insuredSnapshot: { name: '피보험자' },
  contractorSnapshot: { name: '계약자' },
  contractorSameAsInsured: false,
  signatureData: {
    insuredSignature: { storageKey: 'sig/insured.png' },
    contractorSignature: { storageKey: 'sig/contractor.png' },
  },
}

test('validateConsentFormSignatures — same person requires insured signature only', () => {
  const result = validateConsentFormSignatures({
    contractorSameAsInsured: true,
    signatureData: { insuredSignature: { storageKey: 'sig/insured.png' } },
  })
  assert.deepEqual(result, { ok: true })
})

test('validateConsentFormSignatures — different persons require both signatures', () => {
  assert.deepEqual(validateConsentFormSignatures(baseRequest), { ok: true })
  assert.deepEqual(
    validateConsentFormSignatures({
      ...baseRequest,
      signatureData: { insuredSignature: { storageKey: 'sig/insured.png' } },
    }),
    { ok: false, message: '계약자 서명이 필요합니다.' },
  )
  assert.deepEqual(
    validateConsentFormSignatures({
      ...baseRequest,
      signatureData: { contractorSignature: { storageKey: 'sig/contractor.png' } },
    }),
    { ok: false, message: '피보험자 서명이 필요합니다.' },
  )
})

test('resolveConsentFormTargets — same person yields one insured consent', () => {
  assert.deepEqual(resolveConsentFormTargets({ contractorSameAsInsured: true }), [
    { consentTarget: 'insured', label: '동의서' },
  ])
})

test('resolveConsentFormTargets — different persons yield insured and contractor consents', () => {
  assert.deepEqual(resolveConsentFormTargets({ contractorSameAsInsured: false }), [
    { consentTarget: 'insured', label: '피보험자 동의서' },
    { consentTarget: 'contractor', label: '계약자 동의서' },
  ])
})

test('buildGeneratedDocumentMetadataEntry — stores consentTarget for consent forms', () => {
  assert.deepEqual(
    buildGeneratedDocumentMetadataEntry('consent_form', '피보험자 동의서', 'k1', 'insured'),
    {
      type: 'consent_form',
      documentType: 'consent_form',
      label: '피보험자 동의서',
      storageKey: 'k1',
      contentType: 'application/pdf',
      consentTarget: 'insured',
    },
  )
})
