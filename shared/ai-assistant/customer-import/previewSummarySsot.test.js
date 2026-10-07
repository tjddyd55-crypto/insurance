import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CUSTOMER_IMPORT_DUPLICATE_POLICY, CUSTOMER_IMPORT_ROW_STATUS } from './constants.js'
import {
  PREVIEW_ROW_FINAL_STATUS,
  buildImportPreviewSummarySsot,
  classifyPreviewRowFinalStatus,
} from './previewSummarySsot.js'

describe('previewSummarySsot', () => {
  it('uses mutually exclusive buckets that sum to totalCandidates', () => {
    const rows = [
      { status: CUSTOMER_IMPORT_ROW_STATUS.VALID, eligibleForCommit: true, reasons: [] },
      { status: CUSTOMER_IMPORT_ROW_STATUS.WARNING, eligibleForCommit: false, reasons: ['REVIEW_REQUIRED'] },
      {
        status: CUSTOMER_IMPORT_ROW_STATUS.WARNING,
        eligibleForCommit: false,
        reasons: [],
        duplicate: { reason: 'DUPLICATE_EXISTING_CUSTOMER' },
      },
      { status: CUSTOMER_IMPORT_ROW_STATUS.INVALID, eligibleForCommit: false, reasons: [] },
    ]
    const ssot = buildImportPreviewSummarySsot(rows, {
      duplicatePolicy: CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP,
    })
    assert.equal(ssot.totalCandidates, 4)
    assert.equal(ssot.autoEligible, 1)
    assert.equal(ssot.reviewRequired, 1)
    assert.equal(ssot.duplicateSkipped, 1)
    assert.equal(ssot.invalid, 1)
    assert.equal(ssot.plannedCreate, ssot.autoEligible)
    assert.equal(ssot.plannedSkip, ssot.totalCandidates - ssot.plannedCreate)
    assert.equal(
      ssot.autoEligible + ssot.reviewRequired + ssot.duplicateSkipped + ssot.invalid,
      ssot.totalCandidates,
    )
  })

  it('classifies eligible rows as AUTO_ELIGIBLE', () => {
    const bucket = classifyPreviewRowFinalStatus({
      status: CUSTOMER_IMPORT_ROW_STATUS.VALID,
      eligibleForCommit: true,
      reasons: [],
    })
    assert.equal(bucket, PREVIEW_ROW_FINAL_STATUS.AUTO_ELIGIBLE)
  })
})
