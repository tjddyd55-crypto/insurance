import { CUSTOMER_IMPORT_DUPLICATE_POLICY } from '../../shared/ai-assistant/customer-import/constants.js'
import { CUSTOMER_IMPORT_SOURCE_MODE } from '../../shared/ai-assistant/customer-import/importSourceMode.js'
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
import { applyMappingChangeFromText, parseDuplicatePolicyIntent } from './followUpIntent.js'
import { startImportAnalysisJob } from './customer-import/importAnalysisJobService.js'
import {
  buildPreviewCardPayload,
  runImportPreviewPipeline,
} from './importPreviewRunner.js'
import { IMPORT_ANALYSIS_JOB_DISPLAY } from '../../shared/ai-assistant/customer-import/importAnalysisJobConstants.js'
import {
  IMPORT_ORCHESTRATION_ACTION,
  INTENT_DOMAIN,
  TOP_LEVEL_ACTION,
} from '../../shared/ai-assistant/orchestration/intentSchema.js'
import { buildConversationOnlySnapshot } from './intent/buildConversationOnlySnapshot.js'
import { buildIntentContextSnapshot } from './intent/buildIntentContextSnapshot.js'
import { classifyUserIntent } from './intent/classifyUserIntent.js'
import { generateGeneralChatResponse } from './intent/generateGeneralChatResponse.js'
import { logIntentDecision } from './intent/logIntentDecision.js'
import { resolveImportOrchestrationAction } from './intent/resolveImportOrchestrationAction.js'
import { resolveTopLevelOrchestrationAction } from './intent/resolveTopLevelOrchestrationAction.js'
import {
  READ_ORCHESTRATION_ACTION,
  resolveReadOrchestrationAction,
} from './intent/resolveReadOrchestrationAction.js'
import { applyReadOnlyIntentCorrection } from './intent/applyReadOnlyIntentCorrection.js'
import { extractCustomerNameHint } from './intent/customerSearchQuery.js'
import { executeReadTool } from './read-tools/readToolExecutor.js'
import { formatReadToolResponse } from './read-tools/formatReadToolResponse.js'
import { sanitizeUiActions } from './read-tools/navigationActions.js'
import {
  getAssistantScopePolicy,
  isOutOfScopeGeneralQuestion,
} from './scope/assistantScopePolicy.js'
import { isLikelyGeneralConversation } from './intent/detectBusinessToolHint.js'
import {
  detectCapabilitiesQuery,
  detectCustomerQueryableFieldsHelp,
} from './intent/detectCapabilitiesQuery.js'
import { formatCustomerQueryableFieldsHelp } from '../../shared/ai-assistant/customer-query/formatSchemaForPrompt.js'
import { summarizeCustomerQueryForLog } from './customer-query/resolveCustomerQueryFromIntent.js'
import { buildAssistantCapabilitiesMessage } from './read-tools/buildAssistantCapabilitiesMessage.js'

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
  const recentTurns = (conversation.messages ?? [])
    .filter((m) => m.kind === 'text' && m.text)
    .slice(-8)
    .map((m) => ({ role: m.role, text: String(m.text).slice(0, 240) }))

  let snapshot = buildConversationOnlySnapshot({ conversation })
  if (importSessionId) {
    try {
      const sessionForSnapshot = getCustomerImportSession(importSessionId, userId, gaId)
      snapshot = buildIntentContextSnapshot({
        conversation,
        session: sessionForSnapshot,
        userId,
        gaId,
      })
    } catch {
      snapshot = buildConversationOnlySnapshot({ conversation })
    }
  }

  const scopePolicy = getAssistantScopePolicy()
  const intentStarted = Date.now()
  let classified = await classifyUserIntent({ text, snapshot, recentTurns, scopePolicy })

  if (conversation.pendingClarification?.type === 'customer_search_target') {
    const continuationTarget = extractCustomerNameHint(text, { allowBare: true })
    const canRecoverPendingSearch =
      continuationTarget &&
      (
        classified.requiredToolKey === 'customer.search' ||
        !classified.requiredToolKey ||
        classified.domain === INTENT_DOMAIN.GENERAL_CHAT
      )

    if (canRecoverPendingSearch) {
      classified = {
        ...classified,
        domain: INTENT_DOMAIN.ONE_FC_QUERY,
        stage: 'QUERY',
        goal: 'find_customer_from_pending_clarification',
        requestedAction: 'INVOKE_TOOL',
        intent: 'SEARCH',
        requiresTool: true,
        requiredToolKey: 'customer.search',
        requiresClarification: false,
        clarificationQuestion: null,
        target: {
          entityType: 'CUSTOMER',
          name: continuationTarget,
          customerId: null,
          reference: null,
        },
        source: `${classified.source ?? 'unknown'}+pending_clarification_recovery`,
      }
    }
  }

  if (input.forceImportPipeline && importSessionId) {
    classified = {
      ...classified,
      domain: INTENT_DOMAIN.CUSTOMER_IMPORT,
      stage: 'ANALYZE',
      requestedAction: 'START_IMPORT_ANALYSIS',
      commitRequested: false,
      requiresTool: true,
      source: 'force_import_pipeline',
    }
  }

  const routeCustomerImport =
    Boolean(importSessionId) &&
    (classified.domain === INTENT_DOMAIN.CUSTOMER_IMPORT || input.forceImportPipeline)

  if (!routeCustomerImport && scopePolicy.readOnlyBusinessEnabled) {
    let effectiveClassified = classified
    let readDecision = resolveReadOrchestrationAction(effectiveClassified, conversation, text)
    if (readDecision.action === READ_ORCHESTRATION_ACTION.SCOPE_LIMIT) {
      const corrected = applyReadOnlyIntentCorrection(text, effectiveClassified, scopePolicy)
      if (corrected.requiredToolKey && corrected.requiredToolKey !== effectiveClassified.requiredToolKey) {
        effectiveClassified = corrected
        readDecision = resolveReadOrchestrationAction(effectiveClassified, conversation, text)
      }
    }
    classified = effectiveClassified
    logIntentDecision({
      conversationId: conversation.conversationId,
      classified,
      decision: readDecision,
      snapshot,
      durationMs: Date.now() - intentStarted,
      requestId: req.headers?.['x-request-id'],
      customerQuery: readDecision.params?.customerQueryAst
        ? summarizeCustomerQueryForLog(readDecision.params.customerQueryAst)
        : null,
    })

    if (
      classified.interpretationFailed &&
      (
        readDecision.action === READ_ORCHESTRATION_ACTION.SCOPE_LIMIT ||
        readDecision.action === READ_ORCHESTRATION_ACTION.NO_READ_INTENT
      )
    ) {
      const failureCode = classified.classifierFailureCode ?? 'OPENAI_REQUEST_FAILED'
      const reply = {
        role: 'assistant',
        kind: 'error',
        text:
          failureCode === 'OPENAI_QUOTA_EXHAUSTED'
            ? 'AI 해석 엔진의 사용 한도가 소진되어 요청 의미를 해석하지 못했습니다. OpenAI 사용량을 확인한 뒤 다시 시도해 주세요.'
            : 'AI 해석 엔진 연결에 실패해 요청 의미를 확정하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        code: failureCode,
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply], code: failureCode }
    }

    if (readDecision.action === READ_ORCHESTRATION_ACTION.WRITE_BLOCKED) {
      const reply = {
        role: 'assistant',
        kind: 'text',
        text: scopePolicy.writeBlockedMessage,
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }

    if (
      readDecision.action === READ_ORCHESTRATION_ACTION.CAPABILITIES ||
      detectCapabilitiesQuery(text) ||
      String(classified.intent ?? '').toUpperCase() === 'CAPABILITIES'
    ) {
      const cap = buildAssistantCapabilitiesMessage()
      const reply = {
        role: 'assistant',
        kind: 'text',
        text: cap.text,
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }

    if (detectCustomerQueryableFieldsHelp(text)) {
      const reply = {
        role: 'assistant',
        kind: 'text',
        text: formatCustomerQueryableFieldsHelp(),
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }

    if (readDecision.policy === 'INVALID_CUSTOMER_QUERY') {
      const reply = {
        role: 'assistant',
        kind: 'text',
        text: readDecision.queryError?.message ?? '고객 조회 조건을 처리할 수 없습니다.',
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }

    if (readDecision.policy === 'SEARCH_NEED_TARGET') {
      conversation = updateAiConversation(conversation.conversationId, userId, gaId, {
        pendingClarification: {
          type: 'customer_search_target',
          domain: 'CUSTOMER',
          intent: 'SEARCH',
          requiredToolKey: 'customer.search',
          missing: ['customerTarget'],
        },
        lastReadContext: {
          domain: 'CUSTOMER',
          intent: 'SEARCH',
          toolKey: 'customer.search',
        },
      })
      const reply = {
        role: 'assistant',
        kind: 'text',
        text: '찾을 고객의 이름이나 전화번호를 말씀해 주세요.',
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }

    if (
      readDecision.action === READ_ORCHESTRATION_ACTION.SCOPE_LIMIT ||
      (classified.domain === INTENT_DOMAIN.GENERAL_CHAT && !readDecision.toolKey)
    ) {
      const allowShortSmallTalk =
        isLikelyGeneralConversation(text) && !isOutOfScopeGeneralQuestion(text)
      const useScopeLimit =
        isOutOfScopeGeneralQuestion(text) ||
        (!scopePolicy.allowFreeGeneralChat && !allowShortSmallTalk && !classified.requiresTool)
      const reply = {
        role: 'assistant',
        kind: 'text',
        text:
          useScopeLimit
            ? scopePolicy.scopeLimitMessage
            : (
                await generateGeneralChatResponse({
                  text,
                  recentTurns,
                  currentRoute: conversation.pageContext?.currentRoute ?? null,
                  scopePolicy: allowShortSmallTalk
                    ? { ...scopePolicy, allowFreeGeneralChat: true }
                    : scopePolicy,
                })
              ).text,
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }

    if (readDecision.policy === 'NEED_CUSTOMER') {
      const reply = {
        role: 'assistant',
        kind: 'text',
        text: '먼저 고객을 찾아 주세요. (예: 홍길동 찾아줘)',
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }

    if (readDecision.action === READ_ORCHESTRATION_ACTION.EXECUTE_READ_TOOL) {
      try {
        const toolStarted = Date.now()
        let toolResult = await executeReadTool(pool, req, {
          toolKey: readDecision.toolKey,
          params: readDecision.params,
        })
        if (
          readDecision.followUpTool &&
          readDecision.toolKey === 'customer.search' &&
          toolResult.customers?.length === 1
        ) {
          const cid = toolResult.customers[0].customerId
          const followParams = {
            customerId: cid,
            ...(readDecision.followUpParams ?? {}),
          }
          if (readDecision.followUpTool === 'consultation.recent' && !followParams.limit) {
            followParams.limit = 3
          }
          toolResult = await executeReadTool(pool, req, {
            toolKey: readDecision.followUpTool,
            params: followParams,
          })
        } else if (
          readDecision.toolKey === 'customer.search' &&
          toolResult.customers?.length === 1 &&
          (readDecision.navigate || /정보|보여|알려/.test(text))
        ) {
          toolResult = await executeReadTool(pool, req, {
            toolKey: 'customer.get',
            params: { customerId: toolResult.customers[0].customerId },
          })
        }
        const formatted = formatReadToolResponse(toolResult, {
          toolKey: toolResult.toolKey,
          navigate: readDecision.navigate,
          query: readDecision.params?.query,
          includeDate: readDecision.params?.includeDate === true,
        })
        const uiActions = sanitizeUiActions(formatted.uiActions ?? [])
        const readContext = {
          domain: classified.domain ?? null,
          intent: classified.intent ?? classified.requestedAction ?? null,
          toolKey: toolResult.toolKey ?? readDecision.toolKey,
          queryFields: readDecision.params?.customerQueryAst?.filters?.map((f) => f.field) ?? [],
          due: readDecision.toolKey === 'task.list' ? readDecision.params?.due ?? null : null,
          day: readDecision.toolKey === 'schedule.list' ? readDecision.params?.day ?? null : null,
        }
        conversation = updateAiConversation(conversation.conversationId, userId, gaId, {
          pendingClarification: null,
          lastReadContext: readContext,
          ...(formatted.resolvedCustomer
            ? { resolvedEntities: { customer: formatted.resolvedCustomer } }
            : {}),
        })
        const reply = {
          role: 'assistant',
          kind: formatted.kind ?? 'text',
          text: formatted.text,
          customer: formatted.customer ?? undefined,
          options: formatted.options ?? undefined,
          consultations: formatted.consultations ?? undefined,
          uiActions: uiActions.length > 0 ? uiActions : undefined,
          toolKey: toolResult.toolKey,
          toolDurationMs: toolResult.durationMs,
          readLatencyMs: Date.now() - toolStarted,
        }
        appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
        return { conversationId: conversation.conversationId, messages: [reply] }
      } catch (toolError) {
        const code = toolError?.code ?? 'AI_READ_TOOL_FAILED'
        const reply = {
          role: 'assistant',
          kind: 'error',
          text:
            code === 'AI_TOOL_NOT_AVAILABLE'
              ? '요청한 조회 기능은 아직 AI 비서에 연결되지 않았습니다.'
              : '조회를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          code,
        }
        appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
        return { conversationId: conversation.conversationId, messages: [reply], code: code }
      }
    }
  }

  const topDecision = resolveTopLevelOrchestrationAction(classified, snapshot, text)
  logIntentDecision({
    conversationId: conversation.conversationId,
    classified,
    decision: topDecision,
    snapshot,
    durationMs: Date.now() - intentStarted,
    requestId: req.headers?.['x-request-id'],
  })

  if (topDecision.action === TOP_LEVEL_ACTION.GENERAL_CHAT_ANSWER) {
    const answerStarted = Date.now()
    const generated = await generateGeneralChatResponse({
      text,
      recentTurns,
      currentRoute: conversation.pageContext?.currentRoute ?? null,
      scopePolicy,
    })
    logIntentDecision({
      conversationId: conversation.conversationId,
      classified,
      decision: topDecision,
      snapshot,
      durationMs: Date.now() - intentStarted,
      answerUsage: generated.usage
        ? { ...generated.usage, latencyMs: Date.now() - answerStarted }
        : null,
      requestId: req.headers?.['x-request-id'],
    })
    const reply = {
      role: 'assistant',
      kind: 'text',
      text: generated.text,
    }
    appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
    return { conversationId: conversation.conversationId, messages: [reply] }
  }

  if (topDecision.action === TOP_LEVEL_ACTION.UNSUPPORTED_TOOL) {
    const reply = {
      role: 'assistant',
      kind: 'text',
      text: topDecision.assistantText,
    }
    appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
    return { conversationId: conversation.conversationId, messages: [reply] }
  }

  if (topDecision.action === TOP_LEVEL_ACTION.CLARIFY) {
    const reply = {
      role: 'assistant',
      kind: 'text',
      text: topDecision.assistantText,
    }
    appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
    return { conversationId: conversation.conversationId, messages: [reply] }
  }

  if (!routeCustomerImport) {
    const generated = await generateGeneralChatResponse({
      text,
      recentTurns,
      currentRoute: conversation.pageContext?.currentRoute ?? null,
      scopePolicy,
    })
    const reply = {
      role: 'assistant',
      kind: 'text',
      text: generated.text,
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

    snapshot = buildIntentContextSnapshot({ conversation, session, userId, gaId })
    const decision = resolveImportOrchestrationAction(classified, snapshot, text)
    logIntentDecision({
      conversationId: conversation.conversationId,
      classified,
      decision: { ...decision, ...topDecision, action: decision.action },
      snapshot,
      durationMs: Date.now() - intentStarted,
      requestId: req.headers?.['x-request-id'],
    })

    if (decision.action === IMPORT_ORCHESTRATION_ACTION.COMMIT_BUTTON_GUIDANCE) {
      const reply = {
        role: 'assistant',
        kind: 'text',
        text: decision.assistantText,
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }

    if (decision.action === IMPORT_ORCHESTRATION_ACTION.WAIT_IMPORT_ANALYSIS) {
      const reply = {
        role: 'assistant',
        kind: 'text',
        text: decision.assistantText,
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }

    if (decision.action === IMPORT_ORCHESTRATION_ACTION.CLARIFY) {
      const reply = {
        role: 'assistant',
        kind: 'text',
        text: decision.assistantText,
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }

    if (decision.action === IMPORT_ORCHESTRATION_ACTION.UNSTRUCTURED_MAPPING_INFO) {
      const reply = {
        role: 'assistant',
        kind: 'text',
        text:
          '이 파일은 비정형 셀 형식이라 엑셀 「컬럼」 매핑은 적용되지 않습니다. 셀 안 내용을 자동으로 나눠 분석한 미리보기를 확인해 주세요.',
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }

    const duplicateIntent = parseDuplicatePolicyIntent(text)
    if (decision.action === IMPORT_ORCHESTRATION_ACTION.MODIFY_DUPLICATE_POLICY && duplicateIntent) {
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
    if (decision.action === IMPORT_ORCHESTRATION_ACTION.MODIFY_MAPPING) {
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

    if (decision.action === IMPORT_ORCHESTRATION_ACTION.IMPORT_SESSION_HELP) {
      const reply = {
        role: 'assistant',
        kind: 'text',
        text:
          decision.assistantText ??
          '첨부된 가져오기 파일이 있습니다. 고객 등록을 진행하려면 요청해 주시거나, 컬럼 수정·중복 정책을 말씀해 주세요.',
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
      return { conversationId: conversation.conversationId, messages: [reply] }
    }

    if (
      decision.action === IMPORT_ORCHESTRATION_ACTION.START_IMPORT_ANALYSIS &&
      session.importSourceMode === CUSTOMER_IMPORT_SOURCE_MODE.UNSTRUCTURED_CELL_RECORDS
    ) {
      const { job } = startImportAnalysisJob(pool, req, {
        importSessionId,
        conversationId: conversation.conversationId,
        duplicatePolicy: duplicatePolicyFromContext,
      })
      const progressCard = {
        role: 'assistant',
        kind: 'import_analysis_progress',
        text: '고객자료를 분석하고 있습니다.',
        jobId: job.jobId,
        importSessionId,
        status: job.status,
        displayPhase: IMPORT_ANALYSIS_JOB_DISPLAY[job.status] ?? job.status,
        progress: job.progress ?? {},
      }
      appendAiConversationMessage(conversation.conversationId, userId, gaId, progressCard)
      return { conversationId: conversation.conversationId, messages: [progressCard], analysisJobId: job.jobId }
    }

    if (
      decision.action === IMPORT_ORCHESTRATION_ACTION.RUN_PREVIEW_PIPELINE ||
      decision.action === IMPORT_ORCHESTRATION_ACTION.START_IMPORT_ANALYSIS
    ) {
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
    }

    const reply = {
      role: 'assistant',
      kind: 'text',
      text: '요청을 이해하지 못했습니다. 파일 분석이나 미리보기 관련 요청을 다시 말씀해 주세요.',
    }
    appendAiConversationMessage(conversation.conversationId, userId, gaId, reply)
    return { conversationId: conversation.conversationId, messages: [reply] }
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
    return { conversationId: conversation.conversationId, messages: [reply], code: code }
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
