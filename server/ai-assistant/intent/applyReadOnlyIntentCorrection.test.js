import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { INTENT_DOMAIN } from '../../../shared/ai-assistant/orchestration/intentSchema.js'
import { applyReadOnlyIntentCorrection } from './applyReadOnlyIntentCorrection.js'

describe('applyReadOnlyIntentCorrection', () => {
  it('routes today task query to task.list', () => {
    const out = applyReadOnlyIntentCorrection(
      '오늘 할 일 알려줘',
      {
        domain: INTENT_DOMAIN.GENERAL_CHAT,
        requiresTool: false,
        requiredToolKey: null,
        source: 'gpt',
      },
      { readOnlyBusinessEnabled: true },
    )
    assert.equal(out.requiredToolKey, 'task.list')
  })

  it('corrects GENERAL_CHAT mislabel to customer.search', () => {
    const out = applyReadOnlyIntentCorrection(
      '홍길동 찾아줘',
      {
        domain: INTENT_DOMAIN.GENERAL_CHAT,
        requiresTool: false,
        requiredToolKey: null,
        source: 'gpt',
      },
      { readOnlyBusinessEnabled: true },
    )
    assert.equal(out.domain, INTENT_DOMAIN.ONE_FC_QUERY)
    assert.equal(out.requiredToolKey, 'customer.search')
    assert.equal(out.target?.name, '홍길동')
  })
})
