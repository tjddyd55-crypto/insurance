import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { IMPORT_ORCHESTRATION_ACTION, INTENT_STAGE } from '../../../shared/ai-assistant/orchestration/intentSchema.js'
import { classifyUserIntentHeuristic } from './classifyUserIntentHeuristic.js'
import { resolveImportOrchestrationAction } from './resolveImportOrchestrationAction.js'

function snapshotNoPreview() {
  return {
    flags: { attachmentExists: true, previewExists: false, analysisRunning: false },
    customerImport: {
      importSessionId: 's1',
      sourceMode: 'UNSTRUCTURED_CELL_RECORDS',
      previewExists: false,
      analysisRunning: false,
      plannedCreate: null,
    },
  }
}

function snapshotPreview(plannedCreate = 3) {
  return {
    flags: { attachmentExists: true, previewExists: true, analysisRunning: false },
    customerImport: {
      importSessionId: 's1',
      sourceMode: 'UNSTRUCTURED_CELL_RECORDS',
      previewExists: true,
      analysisRunning: false,
      plannedCreate,
    },
  }
}

function snapshotRunning() {
  return {
    flags: { attachmentExists: true, previewExists: false, analysisRunning: true },
    customerImport: {
      importSessionId: 's1',
      previewExists: false,
      analysisRunning: true,
    },
  }
}

describe('import intent orchestration', () => {
  it('고객등록해 with attachment/no preview → ANALYZE', () => {
    const classified = classifyUserIntentHeuristic('고객등록해', snapshotNoPreview())
    const decision = resolveImportOrchestrationAction(classified, snapshotNoPreview(), '고객등록해')
    assert.equal(classified.stage, INTENT_STAGE.ANALYZE)
    assert.equal(decision.action, IMPORT_ORCHESTRATION_ACTION.START_IMPORT_ANALYSIS)
  })

  it('파일 확인해서 고객등록해줘 → ANALYZE', () => {
    const text = '아니 파일첨부한거 확인해서 고객등록해줘'
    const classified = classifyUserIntentHeuristic(text, snapshotNoPreview())
    const decision = resolveImportOrchestrationAction(classified, snapshotNoPreview(), text)
    assert.equal(decision.action, IMPORT_ORCHESTRATION_ACTION.START_IMPORT_ANALYSIS)
  })

  it('이거 고객으로 넣어줘 → ANALYZE', () => {
    const decision = resolveImportOrchestrationAction(
      classifyUserIntentHeuristic('이거 고객으로 넣어줘', snapshotNoPreview()),
      snapshotNoPreview(),
      '이거 고객으로 넣어줘',
    )
    assert.equal(decision.action, IMPORT_ORCHESTRATION_ACTION.START_IMPORT_ANALYSIS)
  })

  it('analysis running + 등록해 → WAIT', () => {
    const decision = resolveImportOrchestrationAction(
      classifyUserIntentHeuristic('등록해', snapshotRunning()),
      snapshotRunning(),
      '등록해',
    )
    assert.equal(decision.action, IMPORT_ORCHESTRATION_ACTION.WAIT_IMPORT_ANALYSIS)
  })

  it('preview + 응 등록해 → COMMIT_BUTTON_GUIDANCE', () => {
    const decision = resolveImportOrchestrationAction(
      classifyUserIntentHeuristic('응 등록해', snapshotPreview(3)),
      snapshotPreview(3),
      '응 등록해',
    )
    assert.equal(decision.action, IMPORT_ORCHESTRATION_ACTION.COMMIT_BUTTON_GUIDANCE)
    assert.match(decision.assistantText, /버튼/)
  })

  it('preview + 중복 빼줘 → MODIFY duplicate', () => {
    const snap = snapshotPreview()
    const classified = classifyUserIntentHeuristic('중복 빼줘', snap)
    const decision = resolveImportOrchestrationAction(classified, snap, '중복 빼줘')
    assert.equal(decision.action, IMPORT_ORCHESTRATION_ACTION.MODIFY_DUPLICATE_POLICY)
  })

  it('no attachment → CLARIFY', () => {
    const snap = {
      flags: { attachmentExists: false, previewExists: false, analysisRunning: false },
      customerImport: { importSessionId: null, previewExists: false },
    }
    const decision = resolveImportOrchestrationAction(
      classifyUserIntentHeuristic('고객등록해', snap),
      snap,
      '고객등록해',
    )
    assert.equal(decision.action, IMPORT_ORCHESTRATION_ACTION.CLARIFY)
  })
})
