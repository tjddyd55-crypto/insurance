import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { INTENT_DOMAIN, TOP_LEVEL_ACTION } from '../../../shared/ai-assistant/orchestration/intentSchema.js'
import { classifyUserIntentHeuristic } from './classifyUserIntentHeuristic.js'
import { resolveTopLevelOrchestrationAction } from './resolveTopLevelOrchestrationAction.js'

describe('general chat routing', () => {
  const emptySnap = {
    flags: { attachmentExists: false, previewExists: false, analysisRunning: false },
    customerImport: { importSessionId: null, previewExists: false, analysisRunning: false },
  }

  it('질문하나 해도 돼? → GENERAL_CHAT', () => {
    const c = classifyUserIntentHeuristic('질문하나 해도 돼?', emptySnap)
    assert.equal(c.domain, INTENT_DOMAIN.GENERAL_CHAT)
    const top = resolveTopLevelOrchestrationAction(c, emptySnap, '질문하나 해도 돼?')
    assert.equal(top.action, TOP_LEVEL_ACTION.GENERAL_CHAT_ANSWER)
    assert.equal(top.selectedTool, null)
  })

  it('내가 질문하나할께 → GENERAL_CHAT', () => {
    const c = classifyUserIntentHeuristic('내가 질문하나할께', emptySnap)
    assert.equal(c.domain, INTENT_DOMAIN.GENERAL_CHAT)
  })

  it('일정 확인 → unsupported tool', () => {
    const c = classifyUserIntentHeuristic('일정 확인', emptySnap)
    assert.equal(c.requiresTool, true)
    const top = resolveTopLevelOrchestrationAction(c, emptySnap, '일정 확인')
    assert.equal(top.action, TOP_LEVEL_ACTION.UNSUPPORTED_TOOL)
    assert.equal(top.selectedTool, 'schedule.list')
  })

  it('김철수 최근 상담내용 → consultation tool not connected', () => {
    const text = '김철수 최근 상담내용 알려줘'
    const c = classifyUserIntentHeuristic(text, emptySnap)
    const top = resolveTopLevelOrchestrationAction(c, emptySnap, text)
    assert.equal(top.action, TOP_LEVEL_ACTION.UNSUPPORTED_TOOL)
    assert.equal(top.selectedTool, 'consultation.recent')
  })

  it('attachment + 질문 하나 할게 → GENERAL_CHAT', () => {
    const snap = {
      flags: { attachmentExists: true, previewExists: false, analysisRunning: false },
      customerImport: { importSessionId: 's1', previewExists: false, analysisRunning: false },
    }
    const c = classifyUserIntentHeuristic('질문 하나 할게', snap)
    assert.equal(c.domain, INTENT_DOMAIN.GENERAL_CHAT)
    const top = resolveTopLevelOrchestrationAction(c, snap, '질문 하나 할게')
    assert.equal(top.action, TOP_LEVEL_ACTION.GENERAL_CHAT_ANSWER)
  })

  it('attachment + 고객등록해 → CUSTOMER_IMPORT route', () => {
    const snap = {
      flags: { attachmentExists: true, previewExists: false, analysisRunning: false },
      customerImport: { importSessionId: 's1', previewExists: false, analysisRunning: false },
    }
    const c = classifyUserIntentHeuristic('고객등록해', snap)
    assert.equal(c.domain, INTENT_DOMAIN.CUSTOMER_IMPORT)
    const top = resolveTopLevelOrchestrationAction(c, snap, '고객등록해')
    assert.equal(top.action, TOP_LEVEL_ACTION.ROUTE_CUSTOMER_IMPORT)
  })

  it('고객 삭제는 어떻게 해? → GENERAL_CHAT (explain)', () => {
    const c = classifyUserIntentHeuristic('고객 삭제는 어떻게 해?', emptySnap)
    assert.equal(c.domain, INTENT_DOMAIN.GENERAL_CHAT)
  })
})
