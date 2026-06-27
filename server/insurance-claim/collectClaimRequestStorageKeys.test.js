import assert from 'node:assert/strict'
import test from 'node:test'

import { collectClaimRequestStorageKeys } from './collectClaimRequestStorageKeys.js'

test('collectClaimRequestStorageKeys collects generated, additional, and signature keys only', () => {
  const keys = collectClaimRequestStorageKeys({
    selectedCustomerAttachmentIds: [101, 102],
    generatedDocumentMetadata: {
      documents: [
        { storageKey: 'insurance-claim-documents/company-1/generated-claim.pdf' },
        { storageKey: 'insurance-claim-documents/company-1/generated-consent-insured.pdf' },
        { storageKey: 'insurance-claim-documents/company-1/generated-consent-contractor.pdf' },
      ],
      claimForm: { storageKey: 'legacy/claim.pdf' },
    },
    additionalAttachmentMetadata: [{ storageKey: 'insurance-claim-requests/7/attachments/extra.pdf' }],
    signatureData: {
      insuredSignature: { storageKey: 'insurance-claim-requests/7/signatures/insured.png' },
      contractorSignature: { storageKey: 'insurance-claim-requests/7/signatures/contractor.png' },
    },
  })

  assert.deepEqual(keys.sort(), [
    'insurance-claim-documents/company-1/generated-claim.pdf',
    'insurance-claim-documents/company-1/generated-consent-contractor.pdf',
    'insurance-claim-documents/company-1/generated-consent-insured.pdf',
    'insurance-claim-requests/7/attachments/extra.pdf',
    'insurance-claim-requests/7/signatures/contractor.png',
    'insurance-claim-requests/7/signatures/insured.png',
    'legacy/claim.pdf',
  ].sort())
  assert.equal(keys.some((key) => key.includes('customer-claim')), false)
})

test('collectClaimRequestStorageKeys collects SSOT insurance/claim-requests keys', () => {
  const keys = collectClaimRequestStorageKeys({
    selectedCustomerAttachmentIds: [901],
    generatedDocumentMetadata: {
      documents: [
        { storageKey: 'insurance/claim-requests/9/7/generated/claim-form-20260627.pdf' },
        { storageKey: 'insurance/claim-requests/9/7/generated/consent-form-insured-20260627.pdf' },
      ],
    },
    additionalAttachmentMetadata: [
      { storageKey: 'insurance/claim-requests/9/7/attachments/extra.pdf' },
    ],
    signatureData: {
      insuredSignature: { storageKey: 'insurance/claim-requests/9/7/signatures/insured.png' },
    },
  })

  assert.match(keys.join(' '), /insurance\/claim-requests\/9\/7\/generated/)
  assert.match(keys.join(' '), /attachments\/extra\.pdf/)
  assert.equal(keys.some((key) => key.includes('901')), false)
})
