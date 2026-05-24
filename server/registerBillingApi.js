import {
  completeMockPayment,
  createPendingInvoice,
  getBillingMe,
  listBillingSubscriptionsAdmin,
  listInvoicesAdmin,
  listInvoicesForUser,
  updateBillingSubscriptionStatusAdmin,
} from './billing/billingService.js'
import { REFUND_POLICY_NOTICE } from './billing/policy.js'
import {
  getPaymentSettingsAdmin,
  getPaymentSettingsPublic,
  updatePaymentSettings,
} from './billing/paymentSettings.js'
import { isSubscriptionSubjectRole } from './subscription/policy.js'

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.requireAuth
 * @param {Function} ctx.requireSuperAdmin
 * @param {Function} ctx.handleDbError
 */
export function registerBillingApi(apiRouter, ctx) {
  const { pool, requireAuth, requireSuperAdmin, handleDbError } = ctx

  function requireBillingSubject(req, res, next) {
    if (!isSubscriptionSubjectRole(req.user?.role)) {
      res.status(403).json({ message: '결제 기능을 이용할 수 없는 계정입니다.' })
      return
    }
    next()
  }

  function mapBillingError(e, res) {
    const code = e?.message ?? ''
    const table = /** @type {Record<string, { status: number; message: string }>} */ ({
      live_payment_not_enabled: { status: 400, message: '실결제 모드가 활성화되지 않았습니다.' },
      pending_invoice_exists: { status: 409, message: '이미 대기 중인 결제 요청이 있습니다.' },
      mock_pay_virtual_only: { status: 400, message: '가상 결제는 virtual 모드에서만 가능합니다.' },
      invoice_not_found: { status: 404, message: '결제 요청을 찾을 수 없습니다.' },
      invoice_not_pending: { status: 400, message: '대기 중인 결제만 처리할 수 있습니다.' },
      invalid_payment_mode: { status: 400, message: '결제 모드는 virtual 또는 live 여야 합니다.' },
      invalid_payment_provider: { status: 400, message: 'PG사 설정이 올바르지 않습니다.' },
      payment_secret_storage_unavailable: {
        status: 400,
        message:
          '시크릿 키 저장을 위해 서버 PAYMENT_SETTINGS_SECRET_KEY 설정이 필요합니다. virtual 모드에서는 키 없이 운영할 수 있습니다.',
      },
      invalid_subscription_status: { status: 400, message: '구독 상태 값이 올바르지 않습니다.' },
      subscription_not_found: { status: 404, message: '구독 정보를 찾을 수 없습니다.' },
    })
    const mapped = table[code]
    if (mapped) {
      res.status(mapped.status).json({ message: mapped.message })
      return true
    }
    return false
  }

  apiRouter.get('/billing/settings', requireAuth, requireBillingSubject, async (req, res) => {
    try {
      const settings = await getPaymentSettingsPublic(pool)
      res.json({
        provider: settings.provider,
        mode: settings.mode,
        isEnabled: settings.isEnabled,
        isVirtualMode: settings.mode === 'virtual',
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/billing/me', requireAuth, requireBillingSubject, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      const me = await getBillingMe(pool, userId)
      res.json({
        ...me,
        refundPolicyNotice: REFUND_POLICY_NOTICE,
      })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/billing/invoices', requireAuth, requireBillingSubject, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      const invoices = await listInvoicesForUser(pool, userId)
      res.json({ invoices })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/billing/invoices', requireAuth, requireBillingSubject, async (req, res) => {
    try {
      const userId = String(req.user?.id ?? '').trim()
      const result = await createPendingInvoice(pool, userId)
      res.status(201).json(result)
    } catch (e) {
      if (mapBillingError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/billing/invoices/:id/mock-pay', requireAuth, requireBillingSubject, async (req, res) => {
    const client = await pool.connect()
    try {
      const invoiceId = Number(req.params.id)
      if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
        res.status(400).json({ message: '잘못된 결제 요청입니다.' })
        return
      }
      const userId = String(req.user?.id ?? '').trim()
      const owner = await pool.query(`SELECT user_id FROM payment_invoices WHERE id = $1 LIMIT 1`, [invoiceId])
      if (!owner.rows[0] || String(owner.rows[0].user_id) !== userId) {
        res.status(404).json({ message: '결제 요청을 찾을 수 없습니다.' })
        return
      }
      await client.query('BEGIN')
      const result = await completeMockPayment(client, invoiceId, userId)
      await client.query('COMMIT')
      res.json({ ok: true, result })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* */
      }
      if (mapBillingError(e, res)) return
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })

  apiRouter.get('/admin/billing/settings', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const settings = await getPaymentSettingsAdmin(pool)
      res.json(settings)
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.patch('/admin/billing/settings', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const actorUserId = String(req.user?.id ?? '').trim() || null
      const settings = await updatePaymentSettings(pool, req.body ?? {}, actorUserId)
      res.json(settings)
    } catch (e) {
      if (mapBillingError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/billing/subscriptions', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const subscriptions = await listBillingSubscriptionsAdmin(pool)
      res.json({ subscriptions })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.patch('/admin/billing/subscriptions/:id/status', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id)
      const status = String(req.body?.status ?? '').trim().toLowerCase()
      if (!Number.isFinite(id) || id <= 0 || !status) {
        res.status(400).json({ message: '잘못된 요청입니다.' })
        return
      }
      const updated = await updateBillingSubscriptionStatusAdmin(pool, id, status)
      res.json(updated)
    } catch (e) {
      if (mapBillingError(e, res)) return
      handleDbError(e, req, res)
    }
  })

  apiRouter.get('/admin/billing/invoices', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const userId = String(req.query?.userId ?? req.query?.user_id ?? '').trim()
      const invoices = await listInvoicesAdmin(pool, { userId: userId || undefined })
      res.json({ invoices })
    } catch (e) {
      handleDbError(e, req, res)
    }
  })

  apiRouter.post('/admin/billing/invoices/:id/mock-pay', requireAuth, requireSuperAdmin, async (req, res) => {
    const client = await pool.connect()
    try {
      const invoiceId = Number(req.params.id)
      if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
        res.status(400).json({ message: '잘못된 결제 요청입니다.' })
        return
      }
      const actorUserId = String(req.user?.id ?? '').trim()
      await client.query('BEGIN')
      const result = await completeMockPayment(client, invoiceId, actorUserId)
      await client.query('COMMIT')
      res.json({ ok: true, result })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* */
      }
      if (mapBillingError(e, res)) return
      handleDbError(e, req, res)
    } finally {
      client.release()
    }
  })
}
