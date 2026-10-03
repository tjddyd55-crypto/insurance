import multer from 'multer'

import { CUSTOMER_IMPORT_FILE_LIMITS } from '../../../shared/ai-assistant/customer-import/constants.js'
import { CUSTOMER_IMPORT_TOOL_KEYS, executeCustomerImportTool } from './toolExecutor.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CUSTOMER_IMPORT_FILE_LIMITS.maxBytes },
})

function sendToolError(res, error) {
  const status = Number(error?.status) || 400
  res.status(status).json({
    success: false,
    code: error?.code ?? 'TOOL_ERROR',
    message: error instanceof Error ? error.message : '요청을 처리하지 못했습니다.',
  })
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{ requireAuth: Function, requireInsuranceFormUserId: Function, parseGaId: Function, handleDbError: Function, pool: import('pg').Pool }} ctx
 */
export function registerCustomerImportApi(apiRouter, ctx) {
  const { requireAuth, requireInsuranceFormUserId, parseGaId, handleDbError, pool } = ctx

  function assertDesignerContext(req, res) {
    const userId = requireInsuranceFormUserId(req, res)
    if (!userId) {
      return null
    }
    const role = String(req.user?.role ?? '')
    if (role === 'SUPER_ADMIN' || role === 'INSURER_MANAGER' || role === 'LOSS_ADJUSTER') {
      res.status(403).json({ message: '이 기능은 GA 설계사 계정에서만 사용할 수 있습니다.' })
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

  apiRouter.post(
    '/ai/customer-import/sessions',
    requireAuth,
    upload.single('file'),
    async (req, res) => {
      try {
        if (!assertDesignerContext(req, res)) {
          return
        }
        const file = req.file
        if (!file?.buffer) {
          res.status(400).json({ message: '파일을 선택해 주세요.' })
          return
        }
        const result = await executeCustomerImportTool(pool, req, CUSTOMER_IMPORT_TOOL_KEYS.FILE_ANALYZE, {
          fileBuffer: file.buffer,
          originalFileName: file.originalname,
          mimeType: file.mimetype,
        })
        res.json({ success: true, ...result })
      } catch (error) {
        sendToolError(res, error)
      }
    },
  )

  apiRouter.post('/ai/customer-import/tools/execute', requireAuth, async (req, res) => {
    try {
      if (!assertDesignerContext(req, res)) {
        return
      }
      const toolKey = String(req.body?.toolKey ?? '').trim()
      const input = req.body?.input ?? {}
      const result = await executeCustomerImportTool(pool, req, toolKey, input)
      res.json({ success: true, ...result })
    } catch (error) {
      try {
        sendToolError(res, error)
      } catch (e) {
        handleDbError(e, req, res)
      }
    }
  })
}
