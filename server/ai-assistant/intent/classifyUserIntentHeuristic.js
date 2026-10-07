import { INTENT_DOMAIN, INTENT_STAGE } from '../../../shared/ai-assistant/orchestration/intentSchema.js'
import {
  detectBusinessToolKeyHint,
  detectCustomerImportGoal,
  isExplainOrGeneralKnowledgeQuestion,
  isLikelyGeneralConversation,
} from './detectBusinessToolHint.js'
import { detectCapabilitiesQuery } from './detectCapabilitiesQuery.js'
import {
  detectNaturalLanguageCommitIntent,
  parseDuplicatePolicyIntent,
  parseMappingChangeIntent,
} from '../followUpIntent.js'

function generalChatIntent(confidence = 0.72) {
  return {
    domain: INTENT_DOMAIN.GENERAL_CHAT,
    stage: INTENT_STAGE.ANSWER,
    goal: 'general_conversation',
    requestedAction: 'NONE',
    targetReference: null,
    commitRequested: false,
    requiresClarification: false,
    clarificationQuestion: null,
    requiresTool: false,
    requiredToolKey: null,
    confidence,
    source: 'heuristic',
  }
}

function businessToolIntent(toolKey, domain, confidence = 0.7) {
  return {
    domain,
    stage: INTENT_STAGE.QUERY,
    goal: 'one_fc_tool_request',
    requestedAction: 'INVOKE_TOOL',
    targetReference: null,
    commitRequested: false,
    requiresClarification: false,
    clarificationQuestion: null,
    requiresTool: true,
    requiredToolKey: toolKey,
    confidence,
    source: 'heuristic',
  }
}

/**
 * State-aware intent when GPT is unavailable or as baseline.
 * @param {string} text
 * @param {object} snapshot from buildIntentContextSnapshot
 */
export function classifyUserIntentHeuristic(text, snapshot, options = {}) {
  const scope = options.scope ?? { readOnlyBusinessEnabled: false, allowFreeGeneralChat: true }
  const ci = snapshot.customerImport ?? {}
  const duplicatePolicy = parseDuplicatePolicyIntent(text)
  const mappingChange = parseMappingChangeIntent(text)
  const commitLanguage = detectNaturalLanguageCommitIntent(text)
  const importGoal = detectCustomerImportGoal(text)

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
      requiresTool: true,
      requiredToolKey: 'customer.import.preview',
      confidence: 0.88,
      source: 'heuristic',
    }
  }

  if (ci.analysisRunning) {
    if (importGoal || commitLanguage) {
      return {
        domain: INTENT_DOMAIN.CUSTOMER_IMPORT,
        stage: INTENT_STAGE.WAIT,
        goal: 'wait_for_import_analysis',
        requestedAction: 'WAIT_IMPORT_ANALYSIS',
        targetReference: 'current_import',
        commitRequested: false,
        requiresClarification: false,
        clarificationQuestion: null,
        requiresTool: false,
        requiredToolKey: null,
        confidence: 0.92,
        source: 'heuristic',
      }
    }
    return generalChatIntent(0.65)
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
        requiresTool: false,
        requiredToolKey: null,
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
        requiresTool: true,
        requiredToolKey: 'customer.import.preview',
        confidence: 0.8,
        source: 'heuristic',
      }
    }
    if (importGoal) {
      return {
        domain: INTENT_DOMAIN.CUSTOMER_IMPORT,
        stage: INTENT_STAGE.QUERY,
        goal: 'preview_follow_up',
        requestedAction: 'PREVIEW_GUIDANCE',
        targetReference: 'current_preview',
        commitRequested: false,
        requiresClarification: false,
        clarificationQuestion: null,
        requiresTool: true,
        requiredToolKey: 'customer.import.preview',
        confidence: 0.55,
        source: 'heuristic',
      }
    }
    if (!isLikelyGeneralConversation(text) && !isExplainOrGeneralKnowledgeQuestion(text)) {
      const toolKey = detectBusinessToolKeyHint(text)
      if (toolKey && !isExplainOrGeneralKnowledgeQuestion(text)) {
        const domain = /보내|발송|삭제|등록해|생성/.test(text)
          ? INTENT_DOMAIN.ONE_FC_ACTION
          : INTENT_DOMAIN.ONE_FC_QUERY
        return businessToolIntent(toolKey, domain)
      }
    }
    return generalChatIntent(0.68)
  }

  const hasAttachment = snapshot.flags?.attachmentExists || ci.importSessionId

  if (hasAttachment && importGoal) {
    return {
      domain: INTENT_DOMAIN.CUSTOMER_IMPORT,
      stage: INTENT_STAGE.ANALYZE,
      goal: 'create_customers_from_attachment',
      requestedAction: 'START_IMPORT_ANALYSIS',
      targetReference: 'current_attachment',
      commitRequested: false,
      requiresClarification: false,
      clarificationQuestion: null,
      requiresTool: true,
      requiredToolKey: 'customer.import.unstructured-extract',
      confidence: 0.78,
      source: 'heuristic',
    }
  }

  if (!hasAttachment && importGoal) {
    return {
      domain: INTENT_DOMAIN.CUSTOMER_IMPORT,
      stage: INTENT_STAGE.CLARIFY,
      goal: 'need_import_source',
      requestedAction: 'CLARIFY',
      targetReference: null,
      commitRequested: false,
      requiresClarification: true,
      clarificationQuestion: '등록할 고객정보를 말씀하시거나 파일을 첨부해 주세요.',
      requiresTool: false,
      requiredToolKey: null,
      confidence: 0.85,
      source: 'heuristic',
    }
  }

  if (scope.readOnlyBusinessEnabled) {
    if (detectCapabilitiesQuery(text)) {
      return {
        domain: INTENT_DOMAIN.ASSISTANT,
        stage: INTENT_STAGE.QUERY,
        goal: 'assistant_capabilities',
        requestedAction: 'CAPABILITIES',
        intent: 'CAPABILITIES',
        targetReference: null,
        commitRequested: false,
        requiresClarification: false,
        clarificationQuestion: null,
        requiresTool: false,
        requiredToolKey: null,
        confidence: 0.82,
        source: 'heuristic',
      }
    }
    if (isLikelyGeneralConversation(text)) {
      return generalChatIntent(0.8)
    }
    if (isExplainOrGeneralKnowledgeQuestion(text)) {
      return generalChatIntent(0.75)
    }
    const toolKey = detectBusinessToolKeyHint(text)
    if (toolKey) {
      const domain = /보내|발송|삭제|등록해|생성/.test(text)
        ? INTENT_DOMAIN.ONE_FC_ACTION
        : INTENT_DOMAIN.ONE_FC_QUERY
      return businessToolIntent(toolKey, domain)
    }
    return {
      ...generalChatIntent(0.55),
      requiresClarification: true,
      clarificationQuestion: '조회할 고객·일정·할 일을 말씀해 주세요.',
    }
  }

  const toolKey = detectBusinessToolKeyHint(text)
  if (toolKey && !isExplainOrGeneralKnowledgeQuestion(text) && !isLikelyGeneralConversation(text)) {
    const domain = /보내|발송|삭제|등록해|생성|수정해/.test(text)
      ? INTENT_DOMAIN.ONE_FC_ACTION
      : INTENT_DOMAIN.ONE_FC_QUERY
    return businessToolIntent(toolKey, domain)
  }

  if (isLikelyGeneralConversation(text) || isExplainOrGeneralKnowledgeQuestion(text)) {
    return generalChatIntent(0.8)
  }

  return generalChatIntent(0.6)
}
