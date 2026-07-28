import {
  getCrmUserBulkSmsRuntimeInfo,
  previewCrmUserBulkSms,
  sendCrmUserBulkSms,
  listCrmUserBulkSmsCampaigns,
  getCrmUserBulkSmsCampaignDetail,
} from './lib/crmUserBulkSmsService.js'
import { isCrmUserBulkSmsEnabled } from './lib/crmUserBulkSmsConfig.js'

/**
 * @param {import('express').Router} apiRouter
 * @param {{
 *   pool: import('pg').Pool;
 *   requireAuth: Function;
 *   requireSuperAdmin: Function;
 *   handleDbError: Function;
 * }} deps
 */
export function registerCrmUserBulkSmsApi(apiRouter, deps) {
  const { pool, requireAuth, requireSuperAdmin, handleDbError } = deps
  const guard = [requireAuth, requireSuperAdmin]

  function mapServiceError(e, res) {
    const status = Number(e?.status) || 0
    const message = e?.publicMessage || e?.message
    const known = new Set([
      'crm_user_bulk_sms_disabled',
      'message_required',
      'users_required',
      'too_many_recipients',
      'confirm_required',
      'no_eligible_recipients',
      'sender_required',
      'provider_unavailable',
      'invalid_campaign',
      'campaign_not_found',
    ])
    if (status >= 400 && status < 600 && (known.has(e?.message) || e?.publicMessage)) {
      res.status(status).json({ success: false, message: message || '요청을 처리할 수 없습니다.' })
      return true
    }
    return false
  }

  apiRouter.get('/admin/users/bulk-sms/runtime', ...guard, async (req, res) => {
    try {
      if (!isCrmUserBulkSmsEnabled()) {
        res.status(403).json({ success: false, message: '사용자 단체문자 기능이 비활성화되어 있습니다.' })
        return
      }
      res.json({ success: true, data: getCrmUserBulkSmsRuntimeInfo() })
    } catch (error) {
      if (!mapServiceError(error, res)) handleDbError(error, req, res)
    }
  })

  apiRouter.post('/admin/users/bulk-sms/preview', ...guard, async (req, res) => {
    try {
      const body = req.body ?? {}
      const userIds = Array.isArray(body.userIds) ? body.userIds : []
      const data = await previewCrmUserBulkSms(pool, {
        actorUserId: String(req.user?.id ?? ''),
        userIds,
        message: body.message,
        title: body.title,
        senderNumber: body.senderNumber,
      })
      res.json({ success: true, data })
    } catch (error) {
      if (!mapServiceError(error, res)) handleDbError(error, req, res)
    }
  })

  apiRouter.post('/admin/users/bulk-sms/send', ...guard, async (req, res) => {
    try {
      const body = req.body ?? {}
      const userIds = Array.isArray(body.userIds) ? body.userIds : []
      const data = await sendCrmUserBulkSms(pool, {
        actorUserId: String(req.user?.id ?? ''),
        userIds,
        message: body.message,
        title: body.title,
        senderNumber: body.senderNumber,
        idempotencyKey: body.idempotencyKey,
        confirm: body.confirm === true,
      })
      res.json({ success: true, data })
    } catch (error) {
      if (!mapServiceError(error, res)) handleDbError(error, req, res)
    }
  })

  apiRouter.get('/admin/users/bulk-sms/history', ...guard, async (req, res) => {
    try {
      const data = await listCrmUserBulkSmsCampaigns(pool, {
        limit: Number(req.query.limit) || 50,
      })
      res.json({ success: true, data })
    } catch (error) {
      if (!mapServiceError(error, res)) handleDbError(error, req, res)
    }
  })

  apiRouter.get('/admin/users/bulk-sms/history/:id', ...guard, async (req, res) => {
    try {
      const data = await getCrmUserBulkSmsCampaignDetail(pool, Number(req.params.id))
      res.json({ success: true, data })
    } catch (error) {
      if (!mapServiceError(error, res)) handleDbError(error, req, res)
    }
  })
}
