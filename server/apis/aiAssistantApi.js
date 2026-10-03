import multer from 'multer'

import { getOpenAiDiagnostics } from '../ai-assistant/openaiConfig.js'
import {
  formatOpenAiFailureReason,
  runOpenAiConnectivitySmoke,
  runOpenAiSemanticSmoke,
} from '../ai-assistant/openaiClient.js'
import { applyImportSessionMappingAndPreview, processAiAssistantMessage } from '../ai-assistant/orchestrator.js'
import { buildMappingRowsForUi } from '../ai-assistant/importPreviewRunner.js'
import { CUSTOMER_IMPORT_FIELD_KEYS } from '../../shared/ai-assistant/customer-import/fieldDictionary.js'
import { CUSTOMER_IMPORT_FIELD_LABELS_KO } from '../../shared/ai-assistant/customer-import/mappingEdit.js'
import { getCustomerImportSession } from '../ai-assistant/customer-import/sessionStore.js'
import { updateAiConversation } from '../ai-assistant/conversation/conversationStore.js'
import { consumePendingImportCommit } from '../ai-assistant/confirmation/confirmationService.js'
import { getLatestAiConversationForUser } from '../ai-assistant/conversation/conversationStore.js'
import { CUSTOMER_IMPORT_TOOL_KEYS, executeCustomerImportTool } from '../ai-assistant/customer-import/toolExecutor.js'
import { CUSTOMER_IMPORT_FILE_LIMITS } from '../../shared/ai-assistant/customer-import/constants.js'
import { isProductionRuntime } from '../lib/crmUserBulkSmsConfig.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CUSTOMER_IMPORT_FILE_LIMITS.maxBytes },
})

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 */
export function registerAiAssistantApi(apiRouter, ctx) {
  const { requireAuth, requireSuperAdmin, requireInsuranceFormUserId, parseGaId, handleDbError, pool } = ctx

  function assertGaDesignerContext(req, res) {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return null
    }
    const role = String(req.user?.role ?? '')
    if (role === 'SUPER_ADMIN' || role === 'INSURER_MANAGER' || role === 'LOSS_ADJUSTER') {
      res.status(403).json({ message: 'AI 비서는 GA 설계사 계정에서 사용할 수 있습니다.' })
      return null
    }
    if ((req.user?.customerAccess ?? 'own') === 'none') {
      res.status(403).json({ message: '고객 정보에 접근할 수 없는 계정입니다.' })
      return null
    }
    const gaId = parseGaId(req.user?.gaId)
    if (gaId == null) {
      res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
      return null
    }
    return { userId, gaId }
  }

  apiRouter.get('/ai/admin/openai-diagnostics', requireAuth, requireSuperAdmin, (req, res) => {
    res.json(getOpenAiDiagnostics())
  })

  apiRouter.post('/ai/admin/openai-connectivity-smoke', requireAuth, requireSuperAdmin, async (req, res) => {
    if (isProductionRuntime()) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Production에서는 사용할 수 없습니다.' })
      return
    }
    try {
      const result = await runOpenAiConnectivitySmoke()
      res.json({
        connectivity: result.pass ? 'PASS' : 'FAIL',
        usage: result.usage,
      })
    } catch (error) {
      res.status(Number(error?.status) || 502).json({
        connectivity: 'FAIL',
        code: error?.code ?? 'OPENAI_REQUEST_FAILED',
        failureReason: error?.failureReason ?? formatOpenAiFailureReason(error, 'responses.create'),
      })
    }
  })

  apiRouter.post('/ai/admin/openai-semantic-smoke', requireAuth, requireSuperAdmin, async (req, res) => {
    if (isProductionRuntime()) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Production에서는 사용할 수 없습니다.' })
      return
    }
    try {
      const result = await runOpenAiSemanticSmoke()
      res.json({
        semantic: result.pass ? 'PASS' : 'FAIL',
        schemaValid: result.schemaValid,
        assignmentCount: result.assignmentCount ?? 0,
        usage: result.usage,
        reason: result.reason ?? null,
      })
    } catch (error) {
      res.status(Number(error?.status) || 502).json({
        semantic: 'FAIL',
        code: error?.code ?? 'OPENAI_REQUEST_FAILED',
        failureReason: error?.failureReason ?? formatOpenAiFailureReason(error, 'semantic.responses.create'),
      })
    }
  })

  apiRouter.get('/ai/assistant/conversations/latest', requireAuth, (req, res) => {
    const ctxUser = assertGaDesignerContext(req, res)
    if (!ctxUser) {
      return
    }
    const latest = getLatestAiConversationForUser(ctxUser.userId, ctxUser.gaId)
    res.json({ conversation: latest })
  })

  apiRouter.post(
    '/ai/assistant/attachments/import-file',
    requireAuth,
    upload.single('file'),
    async (req, res) => {
      try {
        const ctxUser = assertGaDesignerContext(req, res)
        if (!ctxUser) {
          return
        }
        const file = req.file
        if (!file?.buffer) {
          res.status(400).json({ message: '파일을 선택해 주세요.' })
          return
        }
        const analyzed = await executeCustomerImportTool(pool, req, CUSTOMER_IMPORT_TOOL_KEYS.FILE_ANALYZE, {
          fileBuffer: file.buffer,
          originalFileName: file.originalname,
          mimeType: file.mimetype,
        })
        const conversationId = String(req.body?.conversationId ?? req.query?.conversationId ?? '').trim()
        if (conversationId) {
          try {
            updateAiConversation(conversationId, ctxUser.userId, ctxUser.gaId, {
              importSessionId: analyzed.importSessionId,
              importContext: {
                activeImportSessionId: analyzed.importSessionId,
                selectedSheet: analyzed.suggestedSheetName ?? null,
                duplicatePolicy: 'SKIP',
                previewVersionHash: null,
                mappingVersion: null,
                pendingActionId: null,
              },
            })
          } catch {
            /* conversation 없으면 무시 */
          }
        }
        res.json({ success: true, importSessionId: analyzed.importSessionId, analyze: analyzed })
      } catch (error) {
        res.status(Number(error?.status) || 400).json({
          code: error?.code ?? 'ATTACH_FAILED',
          message: error instanceof Error ? error.message : '첨부 실패',
        })
      }
    },
  )

  apiRouter.post('/ai/assistant/messages', requireAuth, async (req, res) => {
    try {
      if (!assertGaDesignerContext(req, res)) {
        return
      }
      const result = await processAiAssistantMessage(pool, req, {
        conversationId: req.body?.conversationId,
        text: req.body?.text,
        importSessionId: req.body?.importSessionId,
        forceImportPipeline: req.body?.forceImportPipeline === true,
        pageContext: req.body?.pageContext,
      })
      res.json({ success: true, ...result })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/ai/assistant/import-sessions/:importSessionId/mapping', requireAuth, (req, res) => {
    const ctxUser = assertGaDesignerContext(req, res)
    if (!ctxUser) {
      return
    }
    try {
      const importSessionId = String(req.params.importSessionId ?? '').trim()
      const session = getCustomerImportSession(importSessionId, ctxUser.userId, ctxUser.gaId)
      res.json({
        success: true,
        importSessionId,
        mappingRows: buildMappingRowsForUi(session),
        duplicatePolicy: session.duplicatePolicy ?? 'SKIP',
        availableFields: CUSTOMER_IMPORT_FIELD_KEYS.map((key) => ({
          key,
          label: CUSTOMER_IMPORT_FIELD_LABELS_KO[key] ?? key,
        })),
      })
    } catch (error) {
      res.status(Number(error?.status) || 400).json({
        code: error?.code ?? 'MAPPING_READ_FAILED',
        message: error instanceof Error ? error.message : '조회 실패',
      })
    }
  })

  apiRouter.put('/ai/assistant/import-sessions/:importSessionId/mapping', requireAuth, async (req, res) => {
    try {
      const ctxUser = assertGaDesignerContext(req, res)
      if (!ctxUser) {
        return
      }
      const importSessionId = String(req.params.importSessionId ?? '').trim()
      const columnMapping = req.body?.columnMapping ?? {}
      const result = await applyImportSessionMappingAndPreview(pool, req, importSessionId, columnMapping, {
        conversationId: req.body?.conversationId,
        duplicatePolicy: req.body?.duplicatePolicy,
      })
      res.json({ success: true, ...result })
    } catch (error) {
      res.status(Number(error?.status) || 400).json({
        code: error?.code ?? 'MAPPING_UPDATE_FAILED',
        message: error instanceof Error ? error.message : '매핑 수정 실패',
      })
    }
  })

  apiRouter.post('/ai/assistant/confirmations/:confirmationId/commit', requireAuth, async (req, res) => {
    try {
      const ctxUser = assertGaDesignerContext(req, res)
      if (!ctxUser) {
        return
      }
      const confirmationId = String(req.params.confirmationId ?? '').trim()
      const importSessionId = String(req.body?.importSessionId ?? '').trim()
      const previewVersionHash = String(req.body?.previewVersionHash ?? '').trim()
      consumePendingImportCommit(confirmationId, ctxUser.userId, ctxUser.gaId, previewVersionHash)
      const session = getCustomerImportSession(importSessionId, ctxUser.userId, ctxUser.gaId)
      const duplicatePolicy =
        req.body?.duplicatePolicy ?? session.duplicatePolicy ?? 'SKIP'
      const result = await executeCustomerImportTool(pool, req, CUSTOMER_IMPORT_TOOL_KEYS.COMMIT, {
        importSessionId,
        previewVersionHash,
        confirmed: true,
        idempotencyKey: confirmationId,
        duplicatePolicy,
      })
      res.json({
        success: true,
        ...result,
        duplicatePolicy,
      })
    } catch (error) {
      res.status(Number(error?.status) || 400).json({
        code: error?.code ?? 'COMMIT_FAILED',
        message: error instanceof Error ? error.message : '등록 실패',
      })
    }
  })
}
