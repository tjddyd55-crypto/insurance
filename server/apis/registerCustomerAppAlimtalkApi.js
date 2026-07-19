import { sendCustomerAppLinkAlimtalk } from '../alimtalk/alimtalkService.js'

function parsePositiveInt(value) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) return null
  return n
}

/**
 * POST /agent/customers/:customerId/customer-app/alimtalk
 * @param {import('express').Router} apiRouter
 * @param {{
 *   pool: import('pg').Pool,
 *   requireAuth: import('express').RequestHandler,
 *   handleDbError: Function,
 * }} ctx
 */
export function registerCustomerAppAlimtalkApi(apiRouter, ctx) {
  const { pool, requireAuth, handleDbError } = ctx

  apiRouter.post('/agent/customers/:customerId/customer-app/alimtalk', requireAuth, async (req, res) => {
    try {
      const customerId = parsePositiveInt(req.params.customerId)
      if (customerId == null) {
        res.status(400).json({ success: false, error: '고객 ID가 올바르지 않습니다.' })
        return
      }
      const agentId = String(req.user?.id ?? '').trim()
      if (!agentId) {
        res.status(401).json({ success: false, error: '로그인이 필요합니다.' })
        return
      }

      // 운영 UI는 body.dryRun 조작 금지 — 서버 env 우선. 테스트용으로만 true 강제 허용.
      const bodyDryRun = req.body?.dryRun
      const forceDryRun = bodyDryRun === true
      const receiver =
        req.body?.receiver != null && String(req.body.receiver).trim() !== ''
          ? String(req.body.receiver)
          : undefined

      const result = await sendCustomerAppLinkAlimtalk(pool, {
        agentId,
        customerId,
        receiver,
        user: req.user,
        reqLike: {
          protocol: req.protocol,
          host: req.get('host'),
        },
        forceDryRun,
      })

      if (!result.success) {
        res.status(result.httpStatus || 400).json({
          success: false,
          message: result.error || '알림톡 발송에 실패했습니다.',
          error: result.error || '알림톡 발송에 실패했습니다.',
          data: result.data,
        })
        return
      }

      res.status(200).json({
        success: true,
        data: result.data,
      })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })
}
