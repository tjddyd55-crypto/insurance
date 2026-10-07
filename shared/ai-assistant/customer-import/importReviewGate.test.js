import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { reasonRequiresImportReview, unstructuredRowRequiresReview } from './importReviewGate.js'

describe('importReviewGate', () => {
  it('blocks auto commit on semantic review warnings', () => {
    assert.equal(reasonRequiresImportReview(['SEMANTIC_REVIEW']), true)
    assert.equal(reasonRequiresImportReview(['OPENAI_REQUEST_FAILED;status=400']), true)
  })

  it('uses unstructured classification', () => {
    assert.equal(
      unstructuredRowRequiresReview({ reasons: [], unstructuredMeta: { classification: 'REVIEW_REQUIRED' } }),
      true,
    )
  })
})
