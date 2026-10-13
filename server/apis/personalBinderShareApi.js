import {
  createPersonalBinderGaShare,
  getActiveShareForBinder,
  listGaSharedBinders,
  loadSharedBinderDetail,
  readSharedBinderFileBuffer,
  revokePersonalBinderGaShare,
} from '../personal-binder/personalBinderShareService.js'
import { importSharedPersonalBinder } from '../personal-binder/personalBinderShareImportService.js'

function positiveId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function requestScope(req, res) {
  const userId = String(req.user?.id ?? '').trim()
  const gaId = Number(req.user?.gaId)
  if (!userId || !Number.isInteger(gaId) || gaId < 1) {
    res.status(401).json({ message: '로그인이 필요합니다.' })
    return null
  }
  return { userId, gaId }
}

function sendError(error, req, res, handleDbError) {
  if (error?.httpStatus) {
    res.status(error.httpStatus).json({ message: error.message, code: error.code })
    return
  }
  handleDbError(error, req, res)
}

export function registerPersonalBinderShareApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.get('/personal-binders/shared', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const rows = await listGaSharedBinders(pool, scope)
      res.json(rows)
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.get('/personal-binders/shared/:shareId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const shareId = positiveId(req.params.shareId)
      if (!shareId) {
        res.status(400).json({ message: '잘못된 공유 ID입니다.' })
        return
      }
      res.json(await loadSharedBinderDetail(pool, scope, shareId))
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.get('/personal-binders/:binderId/share-status', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const binderId = positiveId(req.params.binderId)
      if (!binderId) {
        res.status(400).json({ message: '잘못된 바인더 ID입니다.' })
        return
      }
      const active = await getActiveShareForBinder(pool, scope, binderId)
      res.json({ active })
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.post('/personal-binders/:binderId/share', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const binderId = positiveId(req.params.binderId)
      if (!binderId) {
        res.status(400).json({ message: '잘못된 바인더 ID입니다.' })
        return
      }
      const gaCode = String(req.user?.gaCode ?? scope.gaId)
      const detail = await createPersonalBinderGaShare(pool, scope, gaCode, binderId)
      res.status(201).json(detail)
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.delete('/personal-binders/shared/:shareId', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const shareId = positiveId(req.params.shareId)
      if (!shareId) {
        res.status(400).json({ message: '잘못된 공유 ID입니다.' })
        return
      }
      res.json(await revokePersonalBinderGaShare(pool, scope, shareId))
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.post('/personal-binders/shared/:shareId/import', requireAuth, async (req, res) => {
    try {
      const scope = requestScope(req, res)
      if (!scope) return
      const shareId = positiveId(req.params.shareId)
      if (!shareId) {
        res.status(400).json({ message: '잘못된 공유 ID입니다.' })
        return
      }
      const idempotencyKey =
        String(req.headers['idempotency-key'] ?? req.body?.idempotencyKey ?? '').trim() ||
        `${shareId}:${scope.userId}:${Date.now()}`
      const gaCode = String(req.user?.gaCode ?? scope.gaId)
      const result = await importSharedPersonalBinder(pool, scope, gaCode, shareId, idempotencyKey)
      res.status(result.reused ? 200 : 201).json(result)
    } catch (error) {
      sendError(error, req, res, handleDbError)
    }
  })

  apiRouter.get(
    '/personal-binders/shared/:shareId/files/:shareFileId/download',
    requireAuth,
    async (req, res) => {
      try {
        const scope = requestScope(req, res)
        if (!scope) return
        const shareId = positiveId(req.params.shareId)
        const shareFileId = positiveId(req.params.shareFileId)
        if (!shareId || !shareFileId) {
          res.status(400).json({ message: '잘못된 요청입니다.' })
          return
        }
        const file = await readSharedBinderFileBuffer(pool, scope, shareId, shareFileId)
        res.setHeader('Content-Type', file.mimeType || 'application/octet-stream')
        res.setHeader('Cache-Control', 'private, no-store')
        res.setHeader(
          'Content-Disposition',
          `inline; filename*=UTF-8''${encodeURIComponent(file.originalFileName || 'file')}`,
        )
        res.send(file.buffer)
      } catch (error) {
        sendError(error, req, res, handleDbError)
      }
    },
  )
}
