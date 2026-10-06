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

  it('follow-up files uses resolved customer id', () => {
    const d = resolveReadOrchestrationAction(
      {
        domain: INTENT_DOMAIN.ONE_FC_QUERY,
        intent: 'LIST',
        requiredToolKey: 'customer.files.list',
        requiresTool: true,
        target: { reference: 'previous_customer' },
      },
      { resolvedEntities: { customer: { customerId: 7, name: '홍길동' } } },
      '그 고객 파일 뭐 있어?',
    )
    assert.equal(d.params.customerId, 7)
  })

  it('navigate with resolved customer uses customer.get', () => {
    const d = resolveReadOrchestrationAction(
      {
        domain: INTENT_DOMAIN.ONE_FC_QUERY,
        intent: 'NAVIGATE',
        requiredToolKey: 'customer.get',
        requiresTool: true,
        target: { reference: 'previous_customer' },
      },
      { resolvedEntities: { customer: { customerId: 9, name: '홍길동' } } },
      '그 고객 페이지 열어줘',
    )
    assert.equal(d.toolKey, 'customer.get')
    assert.equal(d.navigate, true)
    assert.equal(d.params.customerId, 9)
  })

  it('customer list with structured query ast', () => {
    const d = resolveReadOrchestrationAction(
      {
        domain: INTENT_DOMAIN.ONE_FC_QUERY,
        intent: 'LIST',
        requiredToolKey: 'customer.list',
        requiresTool: true,
        customerQuery: {
          logic: 'AND',
          filters: [{ field: 'gender', operator: 'EQ', value: 'FEMALE', valueTo: null }],
          sort: [],
          limit: 20,
          unsupportedField: null,
        },
      },
      {},
      '여자 고객 리스트 줘봐',
    )
    assert.equal(d.toolKey, 'customer.list')
    assert.equal(d.params.customerQueryAst.filters[0].value, 'female')
  })

  it('customer list count mode', () => {
    const d = resolveReadOrchestrationAction(
      {
        domain: INTENT_DOMAIN.ONE_FC_QUERY,
        intent: 'COUNT',
        requiredToolKey: 'customer.list',
        requiresTool: true,
      },
      {},
      '고객 몇 명 있어?',
    )
    assert.equal(d.toolKey, 'customer.list')
    assert.equal(d.params.countOnly, true)
  })

  it('customer search without target clarifies', () => {
    const d = resolveReadOrchestrationAction(
      {
        domain: INTENT_DOMAIN.ONE_FC_QUERY,
        intent: 'SEARCH',
        requiredToolKey: 'customer.search',
        requiresTool: true,
        target: { name: '고객' },
      },
      {},
      '고객 찾기',
    )
    assert.equal(d.action, READ_ORCHESTRATION_ACTION.NO_READ_INTENT)
    assert.equal(d.policy, 'SEARCH_NEED_TARGET')
  })

  it('customer search with QA name executes', () => {
    const d = resolveReadOrchestrationAction(
      {
        domain: INTENT_DOMAIN.ONE_FC_QUERY,
        intent: 'SEARCH',
        requiredToolKey: 'customer.search',
        requiresTool: true,
      },
      {},
      'AI테스트_홍길동 찾아줘',
    )
    assert.equal(d.action, READ_ORCHESTRATION_ACTION.EXECUTE_READ_TOOL)
    assert.equal(d.params.query, 'AI테스트_홍길동')
  })

  it('그 고객 찾아줘 without resolved customer needs customer first', () => {
    const d = resolveReadOrchestrationAction(
      {
        domain: INTENT_DOMAIN.ONE_FC_QUERY,
        intent: 'SEARCH',
        requiredToolKey: 'customer.search',
        requiresTool: true,
        target: { reference: 'previous_customer' },
      },
      {},
      '그 고객 찾아줘',
    )
    assert.equal(d.policy, 'NEED_CUSTOMER')
  })

  it('customer list formats separate lines', () => {
    const customers = Array.from({ length: 7 }, (_, i) => ({
      customerId: i + 1,
      name: `AI테스트_${i}`,
      phoneTail: `100${i}`,
    }))
    const f = formatReadToolResponse({
      toolKey: 'customer.list',
      total: 7,
      customers,
      limit: 20,
    })
    assert.equal(f.text.split('\n').length, 8)
    assert.match(f.text, /— 휴대폰 끝/)
  })

  it('task list today omits english date suffix', () => {
    const f = formatReadToolResponse({
      toolKey: 'task.list',
      due: 'today',
      todos: [
        { id: '1', title: 'AI테스트_홍길동 전화하기', dueDate: '2026-10-05' },
        { id: '2', title: 'AI테스트_김철수 서류 확인', dueDate: '2026-10-05' },
      ],
    })
    assert.doesNotMatch(f.text, /Mon|Oct|2026-10-05/)
    assert.match(f.text, /할 일 2건/)
  })

  it('explicit tomorrow task scope overrides a conflicting classifier filter', () => {
    const d = resolveReadOrchestrationAction(
      {
        domain: INTENT_DOMAIN.ONE_FC_QUERY,
        intent: 'LIST',
        requiredToolKey: 'task.list',
        requiresTool: true,
        filters: { due: 'today' },
      },
      {},
      '내일 할일',
    )
    assert.equal(d.params.due, 'tomorrow')
  })

  it('task follow-up inherits previous tomorrow scope and can request date display', () => {
    const d = resolveReadOrchestrationAction(
      {
        domain: INTENT_DOMAIN.ONE_FC_QUERY,
        intent: 'LIST',
        requiredToolKey: 'task.list',
        requiresTool: true,
        filters: { due: null },
      },
      { lastReadContext: { toolKey: 'task.list', due: 'tomorrow' } },
      '날짜와 같이 알려줘',
    )
    assert.equal(d.params.due, 'tomorrow')
    assert.equal(d.params.includeDate, true)

    const f = formatReadToolResponse(
      {
        toolKey: 'task.list',
        due: 'tomorrow',
        todos: [{ id: '1', title: 'AI테스트_이영희 상담 준비', dueDate: '2026-10-06' }],
      },
      { includeDate: true },
    )
    assert.match(f.text, /10월 6일/)
  })

  it('unbounded unfinished task scope clears a previous tomorrow scope', () => {
    const d = resolveReadOrchestrationAction(
      {
        domain: INTENT_DOMAIN.ONE_FC_QUERY,
        intent: 'LIST',
        requiredToolKey: 'task.list',
        requiresTool: true,
        filters: { due: 'all' },
      },
      { lastReadContext: { toolKey: 'task.list', due: 'tomorrow' } },
      '내일 말고 미완료',
    )
    assert.equal(d.params.due, 'all')
  })

  it('all pending task formatter labels the scope and shows dates', () => {
    const f = formatReadToolResponse({
      toolKey: 'task.list',
      due: 'all',
      todos: [
        { id: '1', title: 'A', dueDate: '2026-10-06' },
        { id: '2', title: 'B', dueDate: '2026-10-07' },
      ],
    })
    assert.match(f.text, /^미완료 할 일 2건입니다\./)
    assert.match(f.text, /10월 6일/)
    assert.match(f.text, /10월 7일/)
  })

  it('filtered customer list zero result is described as no matching customers', () => {
    const f = formatReadToolResponse({
      toolKey: 'customer.list',
      total: 0,
      customers: [],
      filterCount: 1,
      limit: 20,
    })
    assert.equal(f.text, '조건에 맞는 고객이 없습니다.')
  })

  it('schedule list uses separate lines without duplicate customer suffix', () => {
    const f = formatReadToolResponse({
      toolKey: 'schedule.list',
      day: 'today',
      events: [
        { title: 'AI테스트_홍길동 · 상령일', customerName: 'AI테스트_홍길동' },
        { title: 'AI테스트_김철수 · 갱신 확인', customerName: 'AI테스트_김철수' },
      ],
    })
    const lines = f.text.split('\n').slice(1)
    assert.equal(lines.length, 2)
    assert.doesNotMatch(lines[0], /AI테스트_홍길동 · AI테스트_홍길동/)
  })

  it('capabilities message lists implemented read tools only', async () => {
    const { buildAssistantCapabilitiesMessage } = await import('./buildAssistantCapabilitiesMessage.js')
    const cap = buildAssistantCapabilitiesMessage()
    assert.ok(cap.implementedToolCount >= 5)
    assert.match(cap.text, /말씀해 보세요/)
    assert.doesNotMatch(cap.text, /customer\.search/)
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
