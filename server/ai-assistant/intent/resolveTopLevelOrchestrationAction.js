import {
  INTENT_DOMAIN,
  INTENT_STAGE,
  TOP_LEVEL_ACTION,
} from '../../../shared/ai-assistant/orchestration/intentSchema.js'
import { loadAiToolRegistry } from '../../../shared/ai-assistant/registry.js'
import { isToolCallableByOrchestrator } from '../toolRegistryAdapter.js'
import {
  detectBusinessToolKeyHint,
  isExplainOrGeneralKnowledgeQuestion,
} from './detectBusinessToolHint.js'

function toolNotConnectedMessage(toolKey) {
  const tool = loadAiToolRegistry().find((t) => t.key === toolKey)
  const label = tool?.name ?? toolKey
  return `「${label}」 기능은 아직 AI 비서에 연결되지 않았습니다.`
}

/**
 * @param {object} classified normalized intent
 * @param {object} snapshot
 * @param {string} text
 */
export function resolveTopLevelOrchestrationAction(classified, snapshot, text) {
  const domain = classified.domain

  if (domain === INTENT_DOMAIN.GENERAL_CHAT) {
    return {
      action: TOP_LEVEL_ACTION.GENERAL_CHAT_ANSWER,
      policy: 'ALLOW',
      requiresTool: false,
      selectedTool: null,
      stage: INTENT_STAGE.ANSWER,
    }
  }

  if (classified.requiresClarification && domain === INTENT_DOMAIN.CLARIFY) {
    return {
      action: TOP_LEVEL_ACTION.CLARIFY,
      policy: 'ALLOW',
      assistantText: classified.clarificationQuestion ?? '조금 더 구체적으로 말씀해 주시겠어요?',
      requiresTool: false,
      selectedTool: null,
      stage: INTENT_STAGE.CLARIFY,
    }
  }

  if (domain === INTENT_DOMAIN.CUSTOMER_IMPORT) {
    const hasImportContext =
      snapshot.flags?.attachmentExists ||
      snapshot.customerImport?.importSessionId ||
      snapshot.customerImport?.previewExists
    if (!hasImportContext) {
      return {
        action: TOP_LEVEL_ACTION.CLARIFY,
        policy: 'ALLOW',
        assistantText:
          classified.clarificationQuestion ??
          '등록할 고객정보를 말씀하시거나 파일을 첨부해 주세요.',
        requiresTool: false,
        selectedTool: null,
        stage: INTENT_STAGE.CLARIFY,
      }
    }
    return {
      action: TOP_LEVEL_ACTION.ROUTE_CUSTOMER_IMPORT,
      policy: 'ALLOW',
      requiresTool: true,
      selectedTool: classified.requiredToolKey ?? 'customer.import.preview',
      stage: classified.stage,
    }
  }

  const businessDomains = new Set([
    INTENT_DOMAIN.ONE_FC_QUERY,
    INTENT_DOMAIN.ONE_FC_ACTION,
    INTENT_DOMAIN.UNSUPPORTED_ONE_FC_ACTION,
  ])

  if (businessDomains.has(domain)) {
    if (isExplainOrGeneralKnowledgeQuestion(text)) {
      return {
        action: TOP_LEVEL_ACTION.GENERAL_CHAT_ANSWER,
        policy: 'ALLOW',
        requiresTool: false,
        selectedTool: null,
        stage: INTENT_STAGE.ANSWER,
      }
    }
    const toolKey = classified.requiredToolKey ?? detectBusinessToolKeyHint(text)
    if (!toolKey) {
      return {
        action: TOP_LEVEL_ACTION.GENERAL_CHAT_ANSWER,
        policy: 'ALLOW',
        requiresTool: false,
        selectedTool: null,
        stage: INTENT_STAGE.ANSWER,
      }
    }
    const gate = isToolCallableByOrchestrator(toolKey)
    if (!gate.ok) {
      return {
        action: TOP_LEVEL_ACTION.UNSUPPORTED_TOOL,
        policy: 'DENY_TOOL',
        assistantText: toolNotConnectedMessage(toolKey),
        requiresTool: true,
        selectedTool: toolKey,
        stage: classified.stage ?? INTENT_STAGE.QUERY,
      }
    }
    return {
      action: TOP_LEVEL_ACTION.UNSUPPORTED_TOOL,
      policy: 'DENY_NOT_WIRED',
      assistantText: '요청을 이해했지만, 이 Phase에서는 해당 Tool 실행 경로가 아직 연결되지 않았습니다.',
      requiresTool: true,
      selectedTool: toolKey,
      stage: classified.stage ?? INTENT_STAGE.QUERY,
    }
  }

  return {
    action: TOP_LEVEL_ACTION.GENERAL_CHAT_ANSWER,
    policy: 'ALLOW',
    requiresTool: false,
    selectedTool: null,
    stage: INTENT_STAGE.ANSWER,
  }
}
