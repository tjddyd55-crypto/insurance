import { CUSTOMER_IMPORT_TOOL_KEYS, executeCustomerImportTool } from './customer-import/toolExecutor.js'
import { runCustomerImportColumnMap } from './column-map/columnMapService.js'
import { createPendingImportCommit } from './confirmation/confirmationService.js'
import {
  appendAiConversationMessage,
  createAiConversation,
  getAiConversation,
  updateAiConversation,
} from './conversation/conversationStore.js'
import { getCustomerImportSession, updateCustomerImportSession } from './customer-import/sessionStore.js'
import { isToolCallableByOrchestrator } from './toolRegistryAdapter.js'
import { loadAiToolRegistry } from '../../shared/ai-assistant/registry.js'

function detectImportIntent(text) {
  const t = String(text ?? '').toLowerCase()
  return /올려|가져오|import|등록|업로드|엑셀|excel|csv/.test(t)
}

function detectUnconnectedToolKey(text) {
  const t = String(text ?? '')
  if (/찾기|검색/.test(t)) {
    return 'customer.search'
  }
  if (/할\s*일|todo|task/i.test(t)) {
    return 'task.list'
  }
  if (/일정|calendar/i.test(t)) {
    return 'schedule.list'
  }
  if (/문자|sms/i.test(t)) {
    return 'sms.send'
  }
  return null
}

function toolNotConnectedMessage(toolKey) {
  const tool = loadAiToolRegistry().find((t) => t.key === toolKey)
  const label = tool?.name ?? toolKey
  return `「${label}」 기능은 아직 AI 비서에 연결되지 않았습니다.`
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {{ conversationId?: string, text: string, importSessionId?: string }} input
 */
export async function processAiAssistantMessage(pool, req, input) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = Number(req.user?.gaId)
  const text = String(input.text ?? '').trim()

  let conversation
  if (input.conversationId) {
    conversation = getAiConversation(input.conversationId, userId, gaId)
  } else {
    conversation = createAiConversation({ userId, gaId, importSessionId: input.importSessionId ?? null })
  }

  if (input.importSessionId) {
    conversation = updateAiConversation(conversation.conversationId, userId, gaId, {
      importSessionId: input.importSessionId,
    })
  }

  appendAiConversationMessage(conversation.conversationId, userId, gaId, {
    role: 'user',
    kind: 'text',
    text,
  })

  const importSessionId = conversation.importSessionId
  if (!importSessionId) {
    const unconnectedKey = detectUnconnectedToolKey(text)
    if (unconnectedKey) {
      const gate = isToolCallableByOrchestrator(unconnectedKey)
      const reply = {
        role: 'assistant',
        kind: 'text',
        text: gate.ok
          ? '요청을 이해했지만, 이 Phase에서는 해당 Tool 실행 경로가 아직 연결되지 않았습니다.'
          : toolNotConnectedMessage(unconnectedKey),
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }
    const reply = {
      role: 'assistant',
      kind: 'text',
      text: '파일을 첨부한 뒤 고객 가져오기를 요청해 주세요. (예: 고객리스트에 올려줘)',
      suggestions: ['고객 엑셀 가져오기', '고객 찾기', '오늘 할 일', '일정 확인'],
    }
    appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
    return { conversationId: conversation.conversationId, messages: [reply] }
  }

  if (!detectImportIntent(text) && !input.forceImportPipeline) {
    const reply = {
      role: 'assistant',
      kind: 'text',
      text: '첨부된 가져오기 파일이 있습니다. 고객 등록을 진행하려면 「고객리스트에 올려줘」처럼 요청해 주세요.',
    }
    appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
    return { conversationId: conversation.conversationId, messages: [reply] }
  }

  const stages = []
  const runTool = async (toolKey, toolInput = {}) => {
    const gate = isToolCallableByOrchestrator(toolKey)
    if (!gate.ok) {
      throw Object.assign(new Error(gate.code), { code: gate.code, status: 400 })
    }
    stages.push({ toolKey, status: 'running' })
    const result = await executeCustomerImportTool(pool, req, toolKey, {
      importSessionId,
      ...toolInput,
    })
    stages[stages.length - 1].status = 'ok'
    return result
  }

  try {
    const session = getCustomerImportSession(importSessionId, userId, gaId)
    const columnMapGate = isToolCallableByOrchestrator(CUSTOMER_IMPORT_TOOL_KEYS.COLUMN_MAP)
    if (columnMapGate.ok) {
      stages.push({ toolKey: CUSTOMER_IMPORT_TOOL_KEYS.COLUMN_MAP, status: 'running' })
      const mapped = await runCustomerImportColumnMap(session)
      updateCustomerImportSession(importSessionId, userId, gaId, {
        columnMapping: mapped.columnMapping,
        previewVersionHash: null,
        commitStatus: 'idle',
      })
      stages[stages.length - 1].status = 'ok'
    }

    await runTool(CUSTOMER_IMPORT_TOOL_KEYS.NORMALIZE)
    await runTool(CUSTOMER_IMPORT_TOOL_KEYS.DUPLICATE_CHECK)
    await runTool(CUSTOMER_IMPORT_TOOL_KEYS.VALIDATION)
    const preview = await runTool(CUSTOMER_IMPORT_TOOL_KEYS.PREVIEW)

    const pending = createPendingImportCommit({
      userId,
      gaId,
      importSessionId,
      previewVersionHash: preview.previewVersionHash,
      summary: preview.summary,
    })

    updateAiConversation(conversation.conversationId, userId, gaId, {
      pendingAction: {
        type: 'customer.import.commit',
        confirmationId: pending.confirmationId,
        importSessionId,
        previewVersionHash: preview.previewVersionHash,
      },
    })

    const card = {
      role: 'assistant',
      kind: 'import_preview_card',
      text: '고객 가져오기 준비가 완료되었습니다.',
      preview: {
        fileName: session.originalFileName,
        summary: preview.summary,
        previewVersionHash: preview.previewVersionHash,
        confirmationId: pending.confirmationId,
      },
      stages,
    }
    appendAiConversationMessage(conversation.conversationId, userId, gaId, card)
    return { conversationId: conversation.conversationId, messages: [card], stages }
  } catch (error) {
    const code = error?.code ?? 'AI_TOOL_FAILED'
    const reply = {
      role: 'assistant',
      kind: 'error',
      text:
        code === 'AI_TOOL_NOT_AVAILABLE'
          ? '요청한 기능은 아직 AI 비서에 연결되지 않았습니다.'
          : '요청을 처리하지 못했습니다.',
      code,
    }
    appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
    return { conversationId: conversation.conversationId, messages: [reply], error: code }
  }
}
