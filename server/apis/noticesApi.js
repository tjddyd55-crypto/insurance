import {
  dismissAdminNoticeForUser,
  getActivePopupNoticeForUser,
} from '../admin-notices/adminNoticeService.js'

/**
 * @param {import('express').Router} apiRouter
 * @param {{ pool: import('pg').Pool, requireAuth: Function, handleDbError: Function }} deps
 */
export function registerNoticesApi(apiRouter, deps) {
  const { pool, requireAuth, handleDbError } = deps

  apiRouter.get('/notices/active-popup', requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      if (!userId) {
        res.status(401).json({ success: false, message: '로그인이 필요합니다.' })
        return
      }
      const data = await getActivePopupNoticeForUser(pool, userId)
      res.json({ success: true, data })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/notices/:id/dismiss', requireAuth, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      if (!userId) {
        res.status(401).json({ success: false, message: '로그인이 필요합니다.' })
        return
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {}
      const suppressToday = body.suppressToday === true || body.suppress_today === true
      const forever = body.forever === true || body.dismissedForever === true
      const result = await dismissAdminNoticeForUser(pool, userId, req.params.id, {
        suppressToday,
        forever,
      })
      res.json({ success: true, data: result })
    } catch (e) {
      const code = e?.message ?? ''
      if (code === 'notice_not_found') {
        res.status(404).json({ success: false, message: '공지를 찾을 수 없습니다.' })
        return
      }
      handleDbError(e, req, res)
    }
  })
}
