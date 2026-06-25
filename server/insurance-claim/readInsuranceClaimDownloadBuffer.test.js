import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveInsuranceClaimDownloadSource } from './readInsuranceClaimDownloadBuffer.js'

describe('resolveInsuranceClaimDownloadSource', () => {
  it('marks generated claim documents', () => {
    assert.equal(
      resolveInsuranceClaimDownloadSource('insurance-claim-documents/c1/generated-claim_form.pdf'),
      'generated',
    )
  })

  it('marks claim request attachments by prefix', () => {
    assert.equal(
      resolveInsuranceClaimDownloadSource('insurance-claim-requests/10/attachments/x.pdf'),
      'claim_attachment',
    )
  })

  it('marks customer app attachments as storage-path fallback readers', () => {
    assert.equal(resolveInsuranceClaimDownloadSource('customer-claim/694/file.jpg'), 'customer_app_attachment')
  })

  it('respects explicit source on ZIP file entries', () => {
    assert.equal(
      resolveInsuranceClaimDownloadSource('legacy/key.jpg', 'customer_app_attachment'),
      'customer_app_attachment',
    )
  })
})

describe('buildInsuranceClaimDownloadFiles customer attachment entries', () => {
  it('includes customer_app_attachment source for selected ids', async () => {
    const { buildInsuranceClaimDownloadFiles } = await import('./buildInsuranceClaimDownloadFiles.js')
    const pool = {
      query: async () => ({
        rows: [{ id: 20, storage_key: 'customer-claim/694/a.jpg', file_name: 'a.jpg', content_type: 'image/jpeg' }],
      }),
    }
    const { files } = await buildInsuranceClaimDownloadFiles(pool, 1, {
      id: 4,
      customerId: 694,
      generatedDocumentMetadata: { documents: [] },
      additionalAttachmentMetadata: [],
      selectedCustomerAttachmentIds: [20],
    })
    assert.equal(files.length, 1)
    assert.equal(files[0].source, 'customer_app_attachment')
    assert.equal(files[0].fileName, '고객첨부_a.jpg')
  })

  it('keeps skipped ids without failing the whole ZIP candidate list', async () => {
    const { buildInsuranceClaimDownloadFiles } = await import('./buildInsuranceClaimDownloadFiles.js')
    const pool = { query: async () => ({ rows: [] }) }
    const { files, skipped } = await buildInsuranceClaimDownloadFiles(pool, 1, {
      id: 4,
      customerId: 694,
      generatedDocumentMetadata: { documents: [] },
      additionalAttachmentMetadata: [],
      selectedCustomerAttachmentIds: [999],
    })
    assert.equal(files.length, 0)
    assert.deepEqual(skipped, ['고객첨부 ID 999'])
  })
})
