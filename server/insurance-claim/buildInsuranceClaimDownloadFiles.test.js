import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildInsuranceClaimDownloadFiles } from './buildInsuranceClaimDownloadFiles.js'

describe('buildInsuranceClaimDownloadFiles', () => {
  it('includes generated PDFs and additional attachments', async () => {
    const pool = { query: async () => ({ rows: [] }) }
    const { files, skipped } = await buildInsuranceClaimDownloadFiles(pool, 1, {
      id: 10,
      customerId: null,
      generatedDocumentMetadata: {
        documents: [
          { documentType: 'claim_form', storageKey: 'insurance-claim-documents/a.pdf' },
          { documentType: 'consent_form', storageKey: 'insurance-claim-documents/b.pdf' },
        ],
      },
      additionalAttachmentMetadata: [
        { storageKey: 'insurance-claim-requests/10/attachments/x.jpg', fileName: '신분증.jpg', contentType: 'image/jpeg' },
      ],
      selectedCustomerAttachmentIds: [],
    })
    assert.equal(files.length, 3)
    assert.equal(files[0].source, 'generated')
    assert.equal(files[2].source, 'claim_attachment')
    assert.deepEqual(
      files.map((file) => file.fileName),
      ['01_청구서.pdf', '02_동의서.pdf', '03_추가첨부_신분증.jpg'],
    )
    assert.equal(skipped.length, 0)
  })

  it('maps selected customer attachment ids with ga guard', async () => {
    const pool = {
      query: async (_sql, params) => ({
        rows: params[0].includes(99)
          ? [{ id: 99, storage_key: 'k1', file_name: '영수증.pdf', content_type: 'application/pdf' }]
          : [],
      }),
    }
    const { files, skipped } = await buildInsuranceClaimDownloadFiles(pool, 7, {
      id: 3,
      customerId: 12,
      generatedDocumentMetadata: { documents: [] },
      additionalAttachmentMetadata: [],
      selectedCustomerAttachmentIds: [99, 100],
    })
    assert.equal(files.length, 1)
    assert.equal(files[0].source, 'customer_app_attachment')
    assert.equal(files[0].fileName, '01_고객첨부_영수증.pdf')
    assert.deepEqual(skipped, ['고객첨부 ID 100'])
  })

  it('names dual consent forms from metadata labels', async () => {
    const pool = { query: async () => ({ rows: [] }) }
    const { files } = await buildInsuranceClaimDownloadFiles(pool, 1, {
      id: 10,
      customerId: null,
      generatedDocumentMetadata: {
        documents: [
          { type: 'claim_form', label: '청구서', storageKey: 'a.pdf' },
          { type: 'consent_form', label: '피보험자 동의서', consentTarget: 'insured', storageKey: 'b.pdf' },
          { type: 'consent_form', label: '계약자 동의서', consentTarget: 'contractor', storageKey: 'c.pdf' },
        ],
      },
      additionalAttachmentMetadata: [],
      selectedCustomerAttachmentIds: [],
    })
    assert.deepEqual(
      files.map((file) => file.fileName),
      ['01_청구서.pdf', '02_피보험자_동의서.pdf', '03_계약자_동의서.pdf'],
    )
  })
})
