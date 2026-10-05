import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { INTENT_DOMAIN } from '../../../shared/ai-assistant/orchestration/intentSchema.js'
import { formatReadToolResponse } from './formatReadToolResponse.js'
import {
  READ_ORCHESTRATION_ACTION,
  resolveReadOrchestrationAction,
} from '../intent/resolveReadOrchestrationAction.js'

describe('read orchestration', () => {
  it('write action blocked in read-only resolver', () => {
    const d = resolveReadOrchestrationAction(
      {
        domain: INTENT_DOMAIN.ONE_FC_ACTION,
        intent: 'DELETE',
        requiredToolKey: 'customer.delete',
        requiresTool: true,
      },
      {},
      '홍길동 삭제해줘',
    )
    assert.equal(d.action, READ_ORCHESTRATION_ACTION.WRITE_BLOCKED)
  })

  it('customer search formats zero results', () => {
    const f = formatReadToolResponse(
      { toolKey: 'customer.search', customers: [] },
      { query: '홍길동' },
    )
    assert.match(f.text, /찾지 못했/)
  })

  it('customer search single result resolves entity', () => {
    const f = formatReadToolResponse({
      toolKey: 'customer.search',
      customers: [{ customerId: 1, name: '홍길동', phone: '010-1234-5678', phoneTail: '5678' }],
    })
    assert.equal(f.resolvedCustomer.customerId, 1)
    assert.match(f.text, /홍길동/)
  })

  it('follow-up consultation uses resolved customer id', () => {
    const d = resolveReadOrchestrationAction(
      {
        domain: INTENT_DOMAIN.ONE_FC_QUERY,
        intent: 'LIST',
        requiredToolKey: 'consultation.recent',
        requiresTool: true,
        target: { reference: 'previous_customer' },
      },
      { resolvedEntities: { customer: { customerId: 42, name: '홍길동' } } },
      '그 사람 최근 상담 보여줘',
    )
    assert.equal(d.action, READ_ORCHESTRATION_ACTION.EXECUTE_READ_TOOL)
    assert.equal(d.params.customerId, 42)
  })
})
