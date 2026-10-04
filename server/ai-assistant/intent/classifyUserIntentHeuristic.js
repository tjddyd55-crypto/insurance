import { INTENT_DOMAIN, INTENT_STAGE } from '../../../shared/ai-assistant/orchestration/intentSchema.js'
import {
  detectNaturalLanguageCommitIntent,
  parseDuplicatePolicyIntent,
  parseMappingChangeIntent,
} from '../followUpIntent.js'

/**
 * State-aware intent when GPT is unavailable or as baseline.
 * Does not execute tools — only classifies.
 * @param {string} text
 * @param {object} snapshot from buildIntentContextSnapshot
 */
export function classifyUserIntentHeuristic(text, snapshot) {
  const ci = snapshot.customerImport ?? {}
  const duplicatePolicy = parseDuplicatePolicyIntent(text)
  const mappingChange = parseMappingChangeIntent(text)
  const commitLanguage = detectNaturalLanguageCommitIntent(text)

  if (duplicatePolicy && ci.previewExists) {
    return {
      domain: INTENT_DOMAIN.CUSTOMER_IMPORT,
      stage: INTENT_STAGE.MODIFY,
      goal: 'adjust_duplicate_policy',
      requestedAction: 'MODIFY_DUPLICATE_POLICY',
      targetReference: 'current_import',
      commitRequested: false,
      requiresClarification: false,
      clarificationQuestion: null,
      confidence: 0.88,
      source: 'heuristic',
    }
  }

  if (ci.analysisRunning) {
    return {
      domain: INTENT_DOMAIN.CUSTOMER_IMPORT,
      stage: INTENT_STAGE.WAIT,
      goal: 'wait_for_import_analysis',
      requestedAction: 'WAIT_IMPORT_ANALYSIS',
      targetReference: 'current_import',
      commitRequested: false,
      requiresClarification: false,
      clarificationQuestion: null,
      confidence: 0.92,
      source: 'heuristic',
    }
  }

  if (ci.previewExists) {
    if (commitLanguage) {
      return {
        domain: INTENT_DOMAIN.CUSTOMER_IMPORT,
        stage: INTENT_STAGE.COMMIT_REQUEST,
        goal: 'confirm_import_after_preview',
        requestedAction: 'COMMIT_REQUEST',
        targetReference: 'current_preview',
        commitRequested: true,
        requiresClarification: false,
        clarificationQuestion: null,
        confidence: 0.82,
        source: 'heuristic',
      }
    }
    if (mappingChange) {
      return {
        domain: INTENT_DOMAIN.CUSTOMER_IMPORT,
        stage: INTENT_STAGE.MODIFY,
        goal: 'change_column_mapping',
        requestedAction: 'MODIFY_MAPPING',
        targetReference: 'current_import',
        commitRequested: false,
        requiresClarification: false,
        clarificationQuestion: null,
        confidence: 0.8,
        source: 'heuristic',
      }
    }
    return {
      domain: INTENT_DOMAIN.CUSTOMER_IMPORT,
      stage: INTENT_STAGE.QUERY,
      goal: 'preview_follow_up',
      requestedAction: 'PREVIEW_GUIDANCE',
      targetReference: 'current_preview',
      commitRequested: false,
      requiresClarification: false,
      clarificationQuestion: null,
      confidence: 0.55,
      source: 'heuristic',
    }
  }

  if (snapshot.flags?.attachmentExists || ci.importSessionId) {
    return {
      domain: INTENT_DOMAIN.CUSTOMER_IMPORT,
      stage: INTENT_STAGE.ANALYZE,
      goal: 'create_customers_from_attachment',
      requestedAction: 'START_IMPORT_ANALYSIS',
      targetReference: 'current_attachment',
      commitRequested: false,
      requiresClarification: false,
      clarificationQuestion: null,
      confidence: 0.78,
      source: 'heuristic',
    }
  }

  return {
    domain: INTENT_DOMAIN.CUSTOMER_IMPORT,
    stage: INTENT_STAGE.CLARIFY,
    goal: 'need_import_source',
    requestedAction: 'CLARIFY',
    targetReference: null,
    commitRequested: false,
    requiresClarification: true,
    clarificationQuestion: '등록할 고객정보를 말씀하시거나 파일을 첨부해 주세요.',
    confidence: 0.85,
    source: 'heuristic',
  }
}
