import multer from 'multer'

import { getOpenAiDiagnostics } from '../ai-assistant/openaiConfig.js'
import { runOpenAiConnectivitySmoke } from '../ai-assistant/openaiClient.js'
import { processAiAssistantMessage } from '../ai-assistant/orchestrator.js'
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
        if (!assertGaDesignerContext(req, res)) {
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
      })
      res.json({ success: true, ...result })
    } catch (error) {
      handleDbError(error, req, res)
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
      const result = await executeCustomerImportTool(pool, req, CUSTOMER_IMPORT_TOOL_KEYS.COMMIT, {
        importSessionId,
        previewVersionHash,
        confirmed: true,
        idempotencyKey: confirmationId,
        duplicatePolicy: req.body?.duplicatePolicy,
      })
      res.json({ success: true, ...result })
    } catch (error) {
      res.status(Number(error?.status) || 400).json({
        code: error?.code ?? 'COMMIT_FAILED',
        message: error instanceof Error ? error.message : '등록 실패',
      })
    }
  })
}
