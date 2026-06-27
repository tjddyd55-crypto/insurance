import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  collectCustomerClaimAppAttachmentKeyCandidates,
  resolveInsuranceClaimDownloadSource,
} from './readInsuranceClaimDownloadBuffer.js'

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
    assert.equal(
      resolveInsuranceClaimDownloadSource(
        'insurance/claim-requests/agent-1/10/attachments/extra.pdf',
      ),
      'claim_attachment',
    )
  })

  it('marks SSOT generated claim documents', () => {
    assert.equal(
      resolveInsuranceClaimDownloadSource(
        'insurance/claim-requests/9/7/generated/claim-form-20260627.pdf',
      ),
      'generated',
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

describe('collectCustomerClaimAppAttachmentKeyCandidates', () => {
  it('adds platform-assets prefix for legacy insurer customer-app-claims keys', () => {
    const legacy =
      'insurer/yjasset/5c2d72a2-7b4d-4b5f-a505-81d5e5018e87/customer-app-claims/1777359820997-cbed9f20-8063-4fc0-a73f-d6bef01fd301-1777359738057.jpg'
    const keys = collectCustomerClaimAppAttachmentKeyCandidates(legacy, {
      gaCode: 'YJASSET',
      customerId: 694,
      requestId: 23,
      fileName: '1777359738057.jpg',
    })
    assert.ok(keys.includes(legacy))
    assert.ok(keys.includes(`platform-assets/${legacy}`))
    assert.ok(
      keys.some((key) =>
        key.includes(
          'insurance/yjasset/users/5c2d72a2-7b4d-4b5f-a505-81d5e5018e87/customer-claim-app-files/694/23/2026/04/1777359820997-1777359738057.jpg',
        ),
      ),
    )
  })
})

describe('buildInsuranceClaimDownloadFiles customer attachment entries', () => {
  it('includes customer_app_attachment source for selected ids', async () => {
    const { buildInsuranceClaimDownloadFiles } = await import('./buildInsuranceClaimDownloadFiles.js')
    const pool = {
      query: async () => ({
        rows: [
          {
            id: 20,
            storage_key:
              'insurer/yjasset/5c2d72a2-7b4d-4b5f-a505-81d5e5018e87/customer-app-claims/1777359820997-cbed9f20-8063-4fc0-a73f-d6bef01fd301-1777359738057.jpg',
            file_name: '1777359738057.jpg',
            content_type: 'image/jpeg',
            agent_id: '5c2d72a2-7b4d-4b5f-a505-81d5e5018e87',
            request_id: 23,
            ga_code: 'YJASSET',
          },
        ],
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
    assert.equal(files[0].fileName, '01_고객첨부_1777359738057.jpg')
    assert.equal(files[0].requestId, 23)
    assert.equal(files[0].gaCode, 'YJASSET')
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
