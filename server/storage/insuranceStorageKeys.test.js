import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  INSURANCE_CLAIM_REQUEST_CATEGORY,
  assertInsuranceStorageKeyPrefix,
  buildInsuranceClaimRequestAttachmentKey,
  buildInsuranceClaimRequestGeneratedKey,
  buildInsuranceClaimRequestKey,
  buildInsuranceCompanyFormKey,
  buildInsuranceFaxJobKey,
  buildInsuranceMessageKey,
  isInsuranceClaimRequestAttachmentKey,
  isInsuranceClaimRequestGeneratedKey,
} from './insuranceStorageKeys.js'

describe('insuranceStorageKeys', () => {
  test('buildInsuranceClaimRequestKey uses insurance/claim-requests prefix', () => {
    const key = buildInsuranceClaimRequestKey({
      userId: 'tjddyd55',
      claimRequestId: 123,
      category: INSURANCE_CLAIM_REQUEST_CATEGORY.GENERATED,
      fileName: 'claim-form-20260627.pdf',
    })
    assert.equal(
      key,
      'insurance/claim-requests/tjddyd55/123/generated/claim-form-20260627.pdf',
    )
    assert.doesNotThrow(() => assertInsuranceStorageKeyPrefix(key))
  })

  test('buildInsuranceClaimRequestAttachmentKey stores under attachments', () => {
    const key = buildInsuranceClaimRequestAttachmentKey({
      userId: 'agent-1',
      claimRequestId: 55,
      fileName: 'id-card.jpg',
    })
    assert.match(key, /^insurance\/claim-requests\/agent-1\/55\/attachments\/[0-9a-f-]+-id-card\.jpg$/)
  })

  test('buildInsuranceClaimRequestGeneratedKey stores generated PDFs', () => {
    const key = buildInsuranceClaimRequestGeneratedKey({
      userId: '9',
      claimRequestId: 7,
      documentType: 'claim_form',
    })
    assert.match(key, /^insurance\/claim-requests\/9\/7\/generated\/claim-form-\d{8}-[0-9a-f]{8}\.pdf$/)
  })

  test('buildInsuranceCompanyFormKey stores admin templates under insurance/forms', () => {
    const key = buildInsuranceCompanyFormKey({
      companyId: 4,
      documentType: 'claim_form',
      fileName: 'claim-template.pdf',
    })
    assert.equal(key, 'insurance/forms/company-4/claim_form/claim-template.pdf')
  })

  test('buildInsuranceFaxJobKey and buildInsuranceMessageKey use insurance prefix', () => {
    const faxKey = buildInsuranceFaxJobKey({
      userId: 'u1',
      faxJobId: 'fax-1',
      category: 'output',
      fileName: 'result.json',
    })
    assert.match(faxKey, /^insurance\/fax-jobs\/u1\/fax-1\/output\/result\.json$/)

    const messageKey = buildInsuranceMessageKey({
      userId: 'u1',
      messageBatchId: 'batch-1',
      category: 'attachments',
      fileName: 'notice.pdf',
    })
    assert.match(messageKey, /^insurance\/messages\/u1\/batch-1\/attachments\/notice\.pdf$/)
  })

  test('assertInsuranceStorageKeyPrefix rejects non-insurance keys', () => {
    assert.throws(
      () => assertInsuranceStorageKeyPrefix('claim-requests/1/file.pdf'),
      /Insurance files must be stored under insurance\//,
    )
  })

  test('generated/attachment key classifiers accept legacy and SSOT paths', () => {
    assert.equal(
      isInsuranceClaimRequestGeneratedKey(
        'insurance-claim-documents/company-4/generated-7-claim_form.pdf',
      ),
      true,
    )
    assert.equal(
      isInsuranceClaimRequestGeneratedKey(
        'insurance/claim-requests/9/7/generated/claim-form-20260627.pdf',
      ),
      true,
    )
    assert.equal(
      isInsuranceClaimRequestAttachmentKey('insurance-claim-requests/7/attachments/extra.pdf'),
      true,
    )
    assert.equal(
      isInsuranceClaimRequestAttachmentKey(
        'insurance/claim-requests/9/7/signatures/insured-abc.png',
      ),
      true,
    )
  })
})
