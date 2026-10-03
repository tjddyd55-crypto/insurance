import { CUSTOMER_IMPORT_DUPLICATE_POLICY } from '../../shared/ai-assistant/customer-import/constants.js'
import { validateUserColumnMapping } from '../../shared/ai-assistant/customer-import/mappingEdit.js'
import { createPendingImportCommit, invalidatePendingForImportSession } from './confirmation/confirmationService.js'
import {
  appendAiConversationMessage,
  createAiConversation,
  getAiConversation,
  getLatestAiConversationForUser,
  updateAiConversation,
} from './conversation/conversationStore.js'
import { getCustomerImportSession, updateCustomerImportSession } from './customer-import/sessionStore.js'
import {
  applyMappingChangeFromText,
  detectNaturalLanguageCommitIntent,
  parseDuplicatePolicyIntent,
} from './followUpIntent.js'
import {
  buildPreviewCardPayload,
  runImportPreviewPipeline,
} from './importPreviewRunner.js'
import { isToolCallableByOrchestrator } from './toolRegistryAdapter.js'
import { loadAiToolRegistry } from '../../shared/ai-assistant/registry.js'

function detectImportIntent(text) {
  const t = String(text ?? '').toLowerCase()
  return /올려|가져오|import|등록|업로드|엑셀|excel|csv|고객리스트|명단/.test(t)
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

function defaultImportContext(importSessionId, session, duplicatePolicy, previewVersionHash) {
  return {
    activeImportSessionId: importSessionId,
    selectedSheet: session?.selectedSheetName ?? null,
    duplicatePolicy,
    previewVersionHash: previewVersionHash ?? null,
    mappingVersion: session?.columnMapping ? JSON.stringify(session.columnMapping) : null,
    pendingActionId: null,
  }
}

async function finalizePreviewConversation(
  pool,
  req,
  conversation,
  userId,
  gaId,
  importSessionId,
  options = {},
) {
  invalidatePendingForImportSession(importSessionId)
  const { session, preview, stages, mappingRows, issueRows, duplicatePolicy } =
    await runImportPreviewPipeline(pool, req, importSessionId, options)

  const pending = createPendingImportCommit({
    userId,
    gaId,
    importSessionId,
    previewVersionHash: preview.previewVersionHash,
    summary: preview.summary,
  })

  const importContext = defaultImportContext(importSessionId, session, duplicatePolicy, preview.previewVersionHash)
  importContext.pendingActionId = pending.confirmationId

  updateAiConversation(conversation.conversationId, userId, gaId, {
    importSessionId,
    importContext,
    pendingAction: {
      type: 'customer.import.commit',
      confirmationId: pending.confirmationId,
      importSessionId,
      previewVersionHash: preview.previewVersionHash,
    },
  })

  const card = {
    ...buildPreviewCardPayload(session, preview, pending, duplicatePolicy),
    mappingRows,
    issueRows,
    statusLabel: stages[stages.length - 1]?.label ?? '등록 전 내용을 정리했어요',
  }
  appendAiConversationMessage(conversation.conversationId, userId, gaId, card)
  return { conversationId: conversation.conversationId, messages: [card] }
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {{ conversationId?: string, text: string, importSessionId?: string, forceImportPipeline?: boolean, pageContext?: object }} input
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

  if (input.pageContext && typeof input.pageContext === 'object') {
    conversation = updateAiConversation(conversation.conversationId, userId, gaId, {
      pageContext: {
        currentRoute: input.pageContext.currentRoute ?? null,
        currentEntityType: input.pageContext.currentEntityType ?? null,
        currentEntityId: input.pageContext.currentEntityId ?? null,
      },
    })
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

  try {
    const session = getCustomerImportSession(importSessionId, userId, gaId)
    const duplicatePolicyFromContext =
      conversation.importContext?.duplicatePolicy ??
      session.duplicatePolicy ??
      CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP

    if (conversation.pendingAction && detectNaturalLanguageCommitIntent(text)) {
      const reply = {
        role: 'assistant',
        kind: 'text',
        text: '등록은 미리보기 카드의 「등록」 버튼으로만 진행할 수 있습니다. 내용을 확인한 뒤 버튼을 눌러 주세요.',
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }

    const duplicateIntent = parseDuplicatePolicyIntent(text)
    if (duplicateIntent) {
      updateCustomerImportSession(importSessionId, userId, gaId, { duplicatePolicy: duplicateIntent })
      const reply = {
        role: 'assistant',
        kind: 'text',
        text:
          duplicateIntent === CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP
            ? '중복 고객은 등록에서 제외하도록 설정했어요. 미리보기를 다시 계산합니다.'
            : '중복 고객도 등록 후보에 포함하도록 설정했어요. 미리보기를 다시 계산합니다.',
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return finalizePreviewConversation(pool, req, conversation, userId, gaId, importSessionId, {
        runGptColumnMap: false,
        duplicatePolicy: duplicateIntent,
      })
    }

    let mappingChanged = false
    try {
      const nextMapping = applyMappingChangeFromText(text, session.headers ?? [], session.columnMapping ?? {})
      if (nextMapping) {
        mappingChanged = true
        updateCustomerImportSession(importSessionId, userId, gaId, {
          columnMapping: nextMapping,
          previewVersionHash: null,
          commitStatus: 'idle',
        })
      }
    } catch (mappingError) {
      if (mappingError?.code === 'UNKNOWN_DESTINATION') {
        const reply = {
          role: 'assistant',
          kind: 'text',
          text: '어느 ONE FC 항목으로 연결할지 이해하지 못했습니다. 예: 「회사 컬럼은 메모로 넣어줘」',
        }
        appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
        return { conversationId: conversation.conversationId, messages: [reply] }
      }
      throw mappingError
    }

    if (mappingChanged) {
      const reply = {
        role: 'assistant',
        kind: 'text',
        text: '컬럼 연결을 수정했어요. 미리보기를 다시 계산합니다.',
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return finalizePreviewConversation(pool, req, conversation, userId, gaId, importSessionId, {
        runGptColumnMap: false,
        duplicatePolicy: duplicatePolicyFromContext,
      })
    }

    if (!detectImportIntent(text) && !input.forceImportPipeline) {
      const reply = {
        role: 'assistant',
        kind: 'text',
        text: '첨부된 가져오기 파일이 있습니다. 고객 등록을 진행하려면 「고객리스트에 올려줘」처럼 요청하거나, 컬럼 수정·중복 정책을 말씀해 주세요.',
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }

    const progress = {
      role: 'assistant',
      kind: 'status',
      text: '파일을 분석하고 있어요…',
    }
    appendAiConversationMessage(conversation.conversationId, userId, gaId, progress)

    return finalizePreviewConversation(pool, req, conversation, userId, gaId, importSessionId, {
      runGptColumnMap: true,
      duplicatePolicy: duplicatePolicyFromContext,
    })
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

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {string} importSessionId
 * @param {Record<string, string>} columnMapping
 * @param {{ conversationId?: string, duplicatePolicy?: string }} [options]
 */
export async function applyImportSessionMappingAndPreview(pool, req, importSessionId, columnMapping, options = {}) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = Number(req.user?.gaId)
  const session = getCustomerImportSession(importSessionId, userId, gaId)
  validateUserColumnMapping(columnMapping, session.headers ?? [])
  updateCustomerImportSession(importSessionId, userId, gaId, {
    columnMapping,
    previewVersionHash: null,
    commitStatus: 'idle',
  })

  let conversation
  if (options.conversationId) {
    conversation = getAiConversation(options.conversationId, userId, gaId)
  } else {
    conversation = getLatestOrCreateConversation(userId, gaId, importSessionId)
  }

  return finalizePreviewConversation(pool, req, conversation, userId, gaId, importSessionId, {
    runGptColumnMap: false,
    duplicatePolicy:
      options.duplicatePolicy ??
      conversation.importContext?.duplicatePolicy ??
      session.duplicatePolicy ??
      CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP,
  })
}

function getLatestOrCreateConversation(userId, gaId, importSessionId) {
  const latest = getLatestAiConversationForUser(userId, gaId)
  if (latest) {
    return latest
  }
  return createAiConversation({ userId, gaId, importSessionId })
}
