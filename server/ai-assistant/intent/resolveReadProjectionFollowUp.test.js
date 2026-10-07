import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveReadOrchestrationAction } from './resolveReadOrchestrationAction.js'

describe('read projection follow-up orchestration', () => {
  it('reuses resolved customer for projection-only detail follow-up', () => {
    const classified = {
      domain: 'CUSTOMER',
      intent: 'GET',
      requestedAction: 'GET',
      requiresTool: true,
      requiredToolKey: 'customer.get',
      target: { entityType: 'CUSTOMER', name: null, customerId: null, reference: null },
      filters: null,
      returnFields: ['customer.address'],
      customerQuery: null,
    }
    const conversation = {
      resolvedEntities: { customer: { customerId: 42, name: '김철수' } },
      lastReadContext: { toolKey: 'customer.get' },
    }

    const decision = resolveReadOrchestrationAction(classified, conversation, '주소만 알려줘')
    assert.equal(decision.action, 'EXECUTE_READ_TOOL')
    assert.equal(decision.toolKey, 'customer.get')
    assert.equal(decision.params.customerId, 42)
    assert.deepEqual(decision.params.returnFields, ['customer.address'])
  })

  it('reuses prior list query when follow-up changes only projection', () => {
    const priorAst = {
      logic: 'AND',
      filters: [{ field: 'customer.gender', operator: 'EQ', value: 'female', valueTo: null }],
      sort: [],
      limit: 7,
    }
    const classified = {
      domain: 'CUSTOMER',
      intent: 'LIST',
      requestedAction: 'LIST',
      requiresTool: true,
      requiredToolKey: 'customer.list',
      target: null,
      filters: null,
      returnFields: ['customer.address'],
      customerQuery: { logic: 'AND', filters: [], sort: [], limit: null, unsupportedField: null },
      limit: null,
    }
    const conversation = {
      lastReadContext: {
        toolKey: 'customer.list',
        customerQueryAst: priorAst,
        limit: 7,
      },
    }

    const decision = resolveReadOrchestrationAction(classified, conversation, '주소만 알려줘')
    assert.equal(decision.action, 'EXECUTE_READ_TOOL')
    assert.equal(decision.toolKey, 'customer.list')
    assert.equal(decision.params.customerQueryAst.filters[0].field, 'customer.gender')
    assert.equal(decision.params.limit, 7)
    assert.deepEqual(decision.params.returnFields, ['customer.address'])
  })
})
