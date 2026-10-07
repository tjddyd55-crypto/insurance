import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  dedupeImportReasonCodes,
  mapImportReasonsForUser,
  reasonCodeToUserMessage,
} from './importReasonPresentation.js'

describe('importReasonPresentation', () => {
  it('maps internal codes to user-facing Korean messages', () => {
    assert.ok(reasonCodeToUserMessage('UNRESOLVED_SEMANTIC_FRAGMENTS').includes('구분'))
    assert.ok(reasonCodeToUserMessage('DUPLICATE_EXISTING_CUSTOMER').includes('기존 고객'))
    assert.ok(reasonCodeToUserMessage('GPT_CONFLICT_phone').includes('확인'))
    assert.equal(reasonCodeToUserMessage('UNKNOWN_INTERNAL_CODE'), '등록 전 확인이 필요합니다.')
  })

  it('dedupes reason codes by base code', () => {
    const codes = dedupeImportReasonCodes([
      'DUPLICATE_EXISTING_CUSTOMER',
      'DUPLICATE_EXISTING_CUSTOMER;extra',
      'REVIEW_REQUIRED',
    ])
    assert.equal(codes.length, 2)
    assert.equal(codes[0], 'DUPLICATE_EXISTING_CUSTOMER')
  })

  it('returns unique user messages per code', () => {
    const mapped = mapImportReasonsForUser(['SEMANTIC_REVIEW', 'SEMANTIC_REVIEW', 'MISSING_PHONE'])
    assert.equal(mapped.length, 2)
    assert.ok(mapped.every((m) => m.message && !m.message.includes('SEMANTIC_')))
  })
})
