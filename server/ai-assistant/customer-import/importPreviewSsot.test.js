import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildImportPreviewSummary } from '../../../shared/ai-assistant/customer-import/preview.js'
import { CUSTOMER_IMPORT_ROW_STATUS } from '../../../shared/ai-assistant/customer-import/constants.js'
import { dedupeImportReasonCodes, mapImportReasonsForUser } from '../../../shared/ai-assistant/customer-import/importReasonPresentation.js'
import { normalizeUploadedFileName } from '../../../shared/ai-assistant/customer-import/filenameEncoding.js'

describe('import preview SSOT (server contract)', () => {
  it('summary buckets are mutually exclusive', () => {
    const rows = [
      { status: CUSTOMER_IMPORT_ROW_STATUS.VALID, eligibleForCommit: true, reasons: [] },
      { status: CUSTOMER_IMPORT_ROW_STATUS.WARNING, eligibleForCommit: false, reasons: ['REVIEW_REQUIRED'] },
    ]
    const summary = buildImportPreviewSummary(rows)
    assert.equal(summary.totalCandidates, 2)
    assert.equal(summary.plannedCreate, summary.autoEligible)
    assert.equal(
      summary.autoEligible + summary.reviewRequired + summary.duplicateSkipped + summary.invalid,
      summary.totalCandidates,
    )
  })

  it('dedupes reasons for presentation', () => {
    const mapped = mapImportReasonsForUser(dedupeImportReasonCodes(['SEMANTIC_REVIEW', 'SEMANTIC_REVIEW']))
    assert.equal(mapped.length, 1)
    assert.ok(!mapped[0].message.includes('SEMANTIC_REVIEW'))
  })

  it('normalizes mojibake filenames', () => {
    const utf8 = '한글.xlsx'
    const broken = Buffer.from(utf8, 'utf8').toString('latin1')
    assert.equal(normalizeUploadedFileName(broken), utf8)
  })
})
