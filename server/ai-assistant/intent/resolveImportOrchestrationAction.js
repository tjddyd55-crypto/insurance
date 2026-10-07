import { CUSTOMER_IMPORT_SOURCE_MODE } from '../../../shared/ai-assistant/customer-import/importSourceMode.js'
import { IMPORT_ORCHESTRATION_ACTION, INTENT_STAGE } from '../../../shared/ai-assistant/orchestration/intentSchema.js'
import { parseMappingChangeIntent } from '../followUpIntent.js'

const COMMIT_GUIDANCE_TEXT =
  '등록은 미리보기 카드의 「N명 등록」 버튼으로만 진행할 수 있습니다. 내용을 확인한 뒤 버튼을 눌러 주세요.'

const WAIT_ANALYSIS_TEXT =
  '현재 고객자료를 분석 중입니다. 분석이 끝나면 등록할 내용을 먼저 보여드릴게요.'

/**
 * Merge GPT/heuristic classification with trusted app state (policy).
 * @param {object} classified
 * @param {object} snapshot
 * @param {string} text
 */
export function resolveImportOrchestrationAction(classified, snapshot, text) {
  const ci = snapshot.customerImport ?? {}
  let stage = classified.stage
  let commitRequested = Boolean(classified.commitRequested)

  if (ci.analysisRunning) {
    return {
      action: IMPORT_ORCHESTRATION_ACTION.WAIT_IMPORT_ANALYSIS,
      policy: 'ALLOW',
      assistantText: WAIT_ANALYSIS_TEXT,
      stage: INTENT_STAGE.WAIT,
      requestedAction: 'WAIT_IMPORT_ANALYSIS',
    }
  }

  if (!ci.previewExists) {
    if (stage === INTENT_STAGE.COMMIT_REQUEST || commitRequested) {
      stage = INTENT_STAGE.ANALYZE
      commitRequested = false
    }
    if (stage === INTENT_STAGE.ANALYZE || stage === INTENT_STAGE.PREVIEW) {
      const unstructured =
        ci.sourceMode === CUSTOMER_IMPORT_SOURCE_MODE.UNSTRUCTURED_CELL_RECORDS
      return {
        action: unstructured
          ? IMPORT_ORCHESTRATION_ACTION.START_IMPORT_ANALYSIS
          : IMPORT_ORCHESTRATION_ACTION.RUN_PREVIEW_PIPELINE,
        policy: 'ALLOW',
        stage: INTENT_STAGE.ANALYZE,
        requestedAction: 'START_IMPORT_ANALYSIS',
      }
    }
    if (stage === INTENT_STAGE.CLARIFY || classified.requiresClarification) {
      return {
        action: IMPORT_ORCHESTRATION_ACTION.CLARIFY,
        policy: 'ALLOW',
        assistantText:
          classified.clarificationQuestion ??
          '등록할 고객정보를 말씀하시거나 파일을 첨부해 주세요.',
        stage: INTENT_STAGE.CLARIFY,
      }
    }
    if (snapshot.flags?.attachmentExists) {
      const unstructured =
        ci.sourceMode === CUSTOMER_IMPORT_SOURCE_MODE.UNSTRUCTURED_CELL_RECORDS
      return {
        action: unstructured
          ? IMPORT_ORCHESTRATION_ACTION.START_IMPORT_ANALYSIS
          : IMPORT_ORCHESTRATION_ACTION.RUN_PREVIEW_PIPELINE,
        policy: 'ALLOW',
        stage: INTENT_STAGE.ANALYZE,
        requestedAction: 'START_IMPORT_ANALYSIS',
      }
    }
    return {
      action: IMPORT_ORCHESTRATION_ACTION.CLARIFY,
      policy: 'ALLOW',
      assistantText: '등록할 고객정보를 말씀하시거나 파일을 첨부해 주세요.',
      stage: INTENT_STAGE.CLARIFY,
    }
  }

  if (ci.previewExists) {
    if (stage === INTENT_STAGE.MODIFY || classified.requestedAction === 'MODIFY_DUPLICATE_POLICY') {
      return {
        action: IMPORT_ORCHESTRATION_ACTION.MODIFY_DUPLICATE_POLICY,
        policy: 'ALLOW',
        stage: INTENT_STAGE.MODIFY,
      }
    }
    if (
      parseMappingChangeIntent(text) &&
      ci.sourceMode === CUSTOMER_IMPORT_SOURCE_MODE.UNSTRUCTURED_CELL_RECORDS
    ) {
      return {
        action: IMPORT_ORCHESTRATION_ACTION.UNSTRUCTURED_MAPPING_INFO,
        policy: 'ALLOW',
        stage: INTENT_STAGE.MODIFY,
      }
    }
    if (stage === INTENT_STAGE.MODIFY || classified.requestedAction === 'MODIFY_MAPPING') {
      return {
        action: IMPORT_ORCHESTRATION_ACTION.MODIFY_MAPPING,
        policy: 'ALLOW',
        stage: INTENT_STAGE.MODIFY,
      }
    }
    if (stage === INTENT_STAGE.COMMIT_REQUEST || commitRequested) {
      const n = ci.plannedCreate ?? 0
      const guidance =
        n > 0
          ? COMMIT_GUIDANCE_TEXT.replace('N명', `${n}명`)
          : '등록 가능한 고객이 없습니다. 미리보기에서 확인이 필요한 항목을 검토해 주세요.'
      return {
        action: IMPORT_ORCHESTRATION_ACTION.COMMIT_BUTTON_GUIDANCE,
        policy: 'DENY_DB_WRITE',
        assistantText: guidance,
        stage: INTENT_STAGE.COMMIT_REQUEST,
      }
    }
    return {
      action: IMPORT_ORCHESTRATION_ACTION.IMPORT_SESSION_HELP,
      policy: 'ALLOW',
      assistantText:
        '미리보기가 준비되어 있습니다. 내용을 확인하시거나, 중복 정책·컬럼 연결을 말씀해 주세요.',
      stage: INTENT_STAGE.QUERY,
    }
  }

  return {
    action: IMPORT_ORCHESTRATION_ACTION.IMPORT_SESSION_HELP,
    policy: 'ALLOW',
    stage: INTENT_STAGE.QUERY,
  }
}
