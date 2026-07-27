import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { systemQuery } from './utils/dbSafeQuery.js'
import { logSecurityEvent } from './lib/securityAudit.js'
import {
  cardNumberLast4,
  maskCardNumberDisplay,
} from './lib/premiumPaymentCardCrypto.js'
import {
  createPremiumPaymentMethod,
  decryptPremiumPaymentRowCard,
  listPremiumPaymentsForCustomer,
  listPremiumPaymentsOverview,
  loadPremiumPaymentCiphertextRow,
  resolvePremiumPaymentActor,
  setPremiumPaymentMethodActive,
  updatePremiumPaymentMethod,
} from './lib/premiumPaymentService.js'

const REAUTH_SCOPE = 'premium-payment-card-reveal'
const REAUTH_TTL = '3m'
const REAUTH_TTL_SECONDS = 180

/** @type {Map<string, number>} jti → expiresAtMs */
const pendingReauthGrants = new Map()

function pruneExpiredReauthGrants(now = Date.now()) {
  for (const [jti, exp] of pendingReauthGrants) {
    if (exp <= now) {
      pendingReauthGrants.delete(jti)
    }
  }
}

/**
 * @param {import('express').Response} res
 */
function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Pragma', 'no-cache')
}

/**
 * @param {unknown} raw
 * @returns {number | null}
 */
function parsePositiveInt(raw) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) {
    return null
  }
  return n
}

/**
 * @param {{ JWT_SECRET: string; userId: string; customerId: number; paymentId: number }} p
 */
function issuePremiumPaymentReauthToken(p) {
  const jti = randomUUID()
  const expiresAtMs = Date.now() + REAUTH_TTL_SECONDS * 1000
  pruneExpiredReauthGrants()
  pendingReauthGrants.set(jti, expiresAtMs)
  return jwt.sign(
    {
      scope: REAUTH_SCOPE,
      sub: p.userId,
      customerId: p.customerId,
      paymentId: p.paymentId,
      jti,
    },
    p.JWT_SECRET,
    { expiresIn: REAUTH_TTL },
  )
}

/**
 * @param {string} token
 * @param {string} JWT_SECRET
 * @param {{ userId: string; customerId: number; paymentId: number }} expected
 * @param {{ consume?: boolean }} [opts]
 */
function verifyPremiumPaymentReauthToken(token, JWT_SECRET, expected, opts = {}) {
  const decoded = jwt.verify(String(token ?? ''), JWT_SECRET)
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('invalid_reauth')
  }
  const payload = /** @type {Record<string, unknown>} */ (decoded)
  if (payload.scope !== REAUTH_SCOPE) {
    throw new Error('invalid_reauth_scope')
  }
  if (String(payload.sub ?? '') !== expected.userId) {
    throw new Error('invalid_reauth_sub')
  }
  if (Number(payload.customerId) !== expected.customerId) {
    throw new Error('invalid_reauth_customer')
  }
  if (Number(payload.paymentId) !== expected.paymentId) {
    throw new Error('invalid_reauth_payment')
  }
  const jti = String(payload.jti ?? '').trim()
  if (!jti) {
    throw new Error('invalid_reauth_jti')
  }
  pruneExpiredReauthGrants()
  if (!pendingReauthGrants.has(jti)) {
    throw new Error('reauth_already_used_or_expired')
  }
  if (opts.consume !== false) {
    pendingReauthGrants.delete(jti)
  }
  return payload
}

/**
 * @param {import('express').Request} req
 * @param {import('pg').Pool} pool
 * @param {object} row
 * @param {string} action
 * @param {number | null} [gaId]
 * @param {object} [meta]
 */
function auditPremiumPayment(pool, req, row, action, gaId, meta = {}) {
  void logSecurityEvent(pool, {
    actorUserId: String(req.user?.id ?? ''),
    actorRole: String(req.user?.role ?? ''),
    action,
    targetType: 'premium_payment_method',
    targetId: String(row?.id ?? ''),
    gaId: gaId ?? null,
    meta: {
      customerId: row?.customerId ?? row?.customer_id ?? null,
      cardNumberLast4: row?.cardNumberLast4 ?? row?.card_number_last4 ?? null,
      ...meta,
    },
  })
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{
 *   pool: import('pg').Pool
 *   requireAuth: import('express').RequestHandler
 *   handleDbError: (e: unknown, req: import('express').Request, res: import('express').Response) => void
 *   JWT_SECRET: string
 * }} deps
 */
export function registerPremiumPaymentApi(apiRouter, { pool, requireAuth, handleDbError, JWT_SECRET }) {
  apiRouter.get('/customers/:customerId/premium-payments', requireAuth, async (req, res) => {
    try {
      setNoStore(res)
      const customerId = parsePositiveInt(req.params.customerId)
      if (customerId == null) {
        res.status(400).json({ message: '유효한 고객 id가 없습니다.' })
        return
      }
      const result = await listPremiumPaymentsForCustomer(pool, req, customerId)
      if (result.error) {
        res.status(result.error.status).json({ message: result.error.message })
        return
      }
      res.json({ premiumPayments: result.rows })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:customerId/premium-payments', requireAuth, async (req, res) => {
    try {
      setNoStore(res)
      const customerId = parsePositiveInt(req.params.customerId)
      if (customerId == null) {
        res.status(400).json({ message: '유효한 고객 id가 없습니다.' })
        return
      }
      const result = await createPremiumPaymentMethod(pool, req, customerId, req.body)
      if (result.error) {
        res.status(result.error.status).json({ message: result.error.message })
        return
      }
      const actor = resolvePremiumPaymentActor(req)
      auditPremiumPayment(pool, req, result.row, 'premium_payment_created', 'error' in actor ? null : actor.gaId)
      res.status(201).json(result.row)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.patch('/customers/:customerId/premium-payments/:paymentId', requireAuth, async (req, res) => {
    try {
      setNoStore(res)
      const customerId = parsePositiveInt(req.params.customerId)
      const paymentId = parsePositiveInt(req.params.paymentId)
      if (customerId == null || paymentId == null) {
        res.status(400).json({ message: '유효한 id가 없습니다.' })
        return
      }
      const result = await updatePremiumPaymentMethod(pool, req, customerId, paymentId, req.body)
      if (result.error) {
        res.status(result.error.status).json({ message: result.error.message })
        return
      }
      const actor = resolvePremiumPaymentActor(req)
      auditPremiumPayment(pool, req, result.row, 'premium_payment_updated', 'error' in actor ? null : actor.gaId)
      res.json(result.row)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:customerId/premium-payments/:paymentId/disable', requireAuth, async (req, res) => {
    try {
      setNoStore(res)
      const customerId = parsePositiveInt(req.params.customerId)
      const paymentId = parsePositiveInt(req.params.paymentId)
      if (customerId == null || paymentId == null) {
        res.status(400).json({ message: '유효한 id가 없습니다.' })
        return
      }
      const result = await setPremiumPaymentMethodActive(pool, req, customerId, paymentId, false)
      if (result.error) {
        res.status(result.error.status).json({ message: result.error.message })
        return
      }
      const actor = resolvePremiumPaymentActor(req)
      auditPremiumPayment(pool, req, result.row, 'premium_payment_disabled', 'error' in actor ? null : actor.gaId)
      res.json(result.row)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post('/customers/:customerId/premium-payments/:paymentId/enable', requireAuth, async (req, res) => {
    try {
      setNoStore(res)
      const customerId = parsePositiveInt(req.params.customerId)
      const paymentId = parsePositiveInt(req.params.paymentId)
      if (customerId == null || paymentId == null) {
        res.status(400).json({ message: '유효한 id가 없습니다.' })
        return
      }
      const result = await setPremiumPaymentMethodActive(pool, req, customerId, paymentId, true)
      if (result.error) {
        res.status(result.error.status).json({ message: result.error.message })
        return
      }
      const actor = resolvePremiumPaymentActor(req)
      auditPremiumPayment(pool, req, result.row, 'premium_payment_enabled', 'error' in actor ? null : actor.gaId)
      res.json(result.row)
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.get('/premium-payments', requireAuth, async (req, res) => {
    try {
      setNoStore(res)
      const q = typeof req.query.q === 'string' ? req.query.q : ''
      let isActive = null
      if (req.query.isActive === 'true' || req.query.active === 'true') {
        isActive = true
      } else if (req.query.isActive === 'false' || req.query.active === 'false') {
        isActive = false
      }
      const limit = Number(req.query.limit)
      const offset = Number(req.query.offset)
      const result = await listPremiumPaymentsOverview(pool, req, {
        q,
        isActive,
        limit: Number.isFinite(limit) ? limit : 50,
        offset: Number.isFinite(offset) ? offset : 0,
      })
      if (result.error) {
        res.status(result.error.status).json({ message: result.error.message })
        return
      }
      res.json({ premiumPayments: result.rows, total: result.total })
    } catch (error) {
      handleDbError(error, req, res)
    }
  })

  apiRouter.post(
    '/customers/:customerId/premium-payments/:paymentId/reauthenticate',
    requireAuth,
    async (req, res) => {
      try {
        setNoStore(res)
        const actor = resolvePremiumPaymentActor(req)
        if ('error' in actor) {
          res.status(actor.error.status).json({ message: actor.error.message })
          return
        }
        const customerId = parsePositiveInt(req.params.customerId)
        const paymentId = parsePositiveInt(req.params.paymentId)
        if (customerId == null || paymentId == null) {
          res.status(400).json({ message: '유효한 id가 없습니다.' })
          return
        }
        const password = String(req.body?.password ?? '')
        if (!password) {
          res.status(400).json({ message: '비밀번호를 입력해 주세요.' })
          return
        }

        const loaded = await loadPremiumPaymentCiphertextRow(pool, req, customerId, paymentId)
        if (loaded.error) {
          res.status(loaded.error.status).json({ message: loaded.error.message })
          return
        }
        if (loaded.row.is_active === false) {
          res.status(403).json({ message: '사용 중지된 결제 정보는 카드번호를 확인할 수 없습니다.' })
          return
        }

        const userR = await systemQuery(
          pool,
          `
          SELECT id, password_hash, role, ga_id
          FROM users
          WHERE id = $1 AND is_deleted = false
          LIMIT 1
          `,
          [actor.userId],
        )
        const user = userR.rows[0]
        if (!user?.password_hash) {
          res.status(401).json({ message: '비밀번호 확인에 실패했습니다.' })
          return
        }
        const match = await bcrypt.compare(password, user.password_hash)
        if (!match) {
          void logSecurityEvent(pool, {
            actorUserId: actor.userId,
            actorRole: String(req.user?.role ?? user.role ?? ''),
            action: 'premium_payment_reauth_failed',
            targetType: 'premium_payment_method',
            targetId: String(paymentId),
            gaId: actor.gaId,
            meta: { customerId, reason: 'bad_password' },
          })
          res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' })
          return
        }

        const reauthToken = issuePremiumPaymentReauthToken({
          JWT_SECRET,
          userId: actor.userId,
          customerId,
          paymentId,
        })
        void logSecurityEvent(pool, {
          actorUserId: actor.userId,
          actorRole: String(req.user?.role ?? user.role ?? ''),
          action: 'premium_payment_reauth_success',
          targetType: 'premium_payment_method',
          targetId: String(paymentId),
          gaId: actor.gaId,
          meta: { customerId },
        })
        res.json({
          reauthToken,
          expiresInSeconds: REAUTH_TTL_SECONDS,
          maskedCardNumber: maskCardNumberDisplay(String(loaded.row.card_number_last4 ?? '')),
        })
      } catch (error) {
        handleDbError(error, req, res)
      }
    },
  )

  apiRouter.post(
    '/customers/:customerId/premium-payments/:paymentId/reveal-card-number',
    requireAuth,
    async (req, res) => {
      try {
        setNoStore(res)
        const actor = resolvePremiumPaymentActor(req)
        if ('error' in actor) {
          res.status(actor.error.status).json({ message: actor.error.message })
          return
        }
        const customerId = parsePositiveInt(req.params.customerId)
        const paymentId = parsePositiveInt(req.params.paymentId)
        if (customerId == null || paymentId == null) {
          res.status(400).json({ message: '유효한 id가 없습니다.' })
          return
        }
        const reauthToken = String(req.body?.reauthToken ?? '').trim()
        if (!reauthToken) {
          res.status(400).json({ message: '재인증이 필요합니다.' })
          return
        }

        const loaded = await loadPremiumPaymentCiphertextRow(pool, req, customerId, paymentId)
        if (loaded.error) {
          res.status(loaded.error.status).json({ message: loaded.error.message })
          return
        }
        if (loaded.row.is_active === false) {
          res.status(403).json({ message: '사용 중지된 결제 정보는 카드번호를 확인할 수 없습니다.' })
          return
        }

        try {
          verifyPremiumPaymentReauthToken(reauthToken, JWT_SECRET, {
            userId: actor.userId,
            customerId,
            paymentId,
          })
        } catch {
          res.status(401).json({ message: '재인증이 만료되었거나 유효하지 않습니다. 다시 확인해 주세요.' })
          return
        }

        const decrypted = decryptPremiumPaymentRowCard(loaded.row)
        if ('error' in decrypted) {
          res.status(500).json({ message: decrypted.error })
          return
        }

        void logSecurityEvent(pool, {
          actorUserId: actor.userId,
          actorRole: String(req.user?.role ?? ''),
          action: 'premium_payment_card_revealed',
          targetType: 'premium_payment_method',
          targetId: String(paymentId),
          gaId: actor.gaId,
          meta: {
            customerId,
            cardNumberLast4: cardNumberLast4(decrypted.digits),
          },
        })

        res.json({
          cardNumber: decrypted.digits,
          cardNumberLast4: cardNumberLast4(decrypted.digits),
          maskedCardNumber: maskCardNumberDisplay(decrypted.digits),
        })
      } catch (error) {
        handleDbError(error, req, res)
      }
    },
  )
}
