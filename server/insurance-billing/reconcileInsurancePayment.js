/**
 * Toss provider 상태 조회 기반 billing_payments 복구 SSOT.
 */

import { resolvePaymentSettingsInternal } from '../billing/paymentSettingsResolve.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { finalizeInsurancePaymentAsPaid, recordBillingEvent } from './subscriptionLifecycle.js'
import { getTossPayment, getTossPaymentByOrderId } from './providers/toss/tossHttpClient.js'
import { validateTossPaymentAgainstExpected } from './providers/toss/tossPaymentValidation.js'
import { normalizeTossApiFailure } from './providers/toss/tossErrorNormalization.js'

function isUniqueViolation(error) {
  return String(error?.code ?? '') === '23505'
}

/**
 * @param {import('pg').PoolClient} client
 * @param {string} provider
 * @param {string} paymentKey
 * @param {number} paymentId
 */
async function assertProviderPaymentKeyAvailable(client, provider, paymentKey, paymentId) {
  const dup = await systemQuery(
    client,
    `
    SELECT id
    FROM billing_payments
    WHERE provider = $1
      AND provider_payment_key = $2
      AND id <> $3
    LIMIT 1
    `,
    [provider, paymentKey, paymentId],
  )
  if (dup.rowCount > 0) {
    const err = new Error('provider_payment_key_conflict')
    err.existingPaymentId = Number(dup.rows[0]?.id)
    throw err
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ payment: object; tossPayment: object; source?: string; periodAnchor?: Date | string | null }} params
 */
export async function finalizeReconciledTossPayment(client, params) {
  const payment = params.payment
  const paymentId = Number(payment.id)
  const expected = {
    orderId: String(payment.order_id ?? ''),
    totalAmount: Number(payment.total_amount ?? 0),
  }
  const validated = validateTossPaymentAgainstExpected(params.tossPayment, expected)
  if (!validated.ok) {
    const err = new Error(`toss_payment_${validated.reason}`)
    err.validation = validated
    throw err
  }

  await assertProviderPaymentKeyAvailable(client, String(payment.provider ?? 'toss'), validated.paymentKey, paymentId)

  if (String(payment.status) === 'pending') {
    await systemQuery(
      client,
      `
      UPDATE billing_payments
      SET provider_payment_key = $2, updated_at = NOW()
      WHERE id = $1
        AND status = 'pending'
      `,
      [paymentId, validated.paymentKey],
    )
  }

  const paid = await finalizeInsurancePaymentAsPaid(client, {
    paymentId,
    source: params.source ?? 'toss',
    periodAnchor: params.periodAnchor ?? null,
  })

  await recordBillingEvent(client, {
    tenantId: payment.tenant_id,
    userId: String(payment.user_id),
    eventType: 'payment.toss.reconciled',
    payload: {
      paymentId,
      orderId: expected.orderId,
      providerPaymentKeySuffix: validated.paymentKey.slice(-6),
      providerStatus: validated.providerStatus,
    },
  })

  return paid
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ paymentId: number | string; secretKey?: string | null; source?: string; periodAnchor?: Date | string | null }} params
 */
export async function reconcilePendingInsurancePayment(executor, params) {
  const paymentId = Number(params.paymentId)
  if (!Number.isFinite(paymentId) || paymentId <= 0) {
    throw new Error('invalid_payment_id')
  }

  const client =
    executor && typeof executor.connect === 'function'
      ? await executor.connect()
      : executor
  const ownsClient = Boolean(executor && typeof executor.connect === 'function')

  try {
    if (ownsClient) {
      await client.query('BEGIN')
    }

    const payR = await systemQuery(
      client,
      `
      SELECT *
      FROM billing_payments
      WHERE id = $1
      FOR UPDATE
      `,
      [paymentId],
    )
    const payment = payR.rows[0]
    if (!payment) {
      throw new Error('payment_not_found')
    }
    if (String(payment.status) === 'paid') {
      const result = await finalizeInsurancePaymentAsPaid(client, {
        paymentId,
        source: params.source ?? 'toss',
        periodAnchor: params.periodAnchor ?? null,
      })
      if (ownsClient) {
        await client.query('COMMIT')
      }
      return { outcome: 'already_paid', paymentId, ...result }
    }
    if (String(payment.status) !== 'pending') {
      throw new Error('payment_not_reconcilable')
    }

    let secretKey = params.secretKey ? String(params.secretKey).trim() : ''
    if (!secretKey) {
      const settings = await resolvePaymentSettingsInternal(client)
      if (!settings.hasSecretKey || !settings.secretKey) {
        throw new Error('payment_secret_storage_unavailable')
      }
      secretKey = settings.secretKey
    }

    let providerRes = null
    const existingKey = String(payment.provider_payment_key ?? '').trim()
    const orderId = String(payment.order_id ?? '').trim()

    if (existingKey) {
      providerRes = await getTossPayment({ secretKey, paymentKey: existingKey })
    } else if (orderId) {
      providerRes = await getTossPaymentByOrderId({ secretKey, orderId })
    } else {
      throw new Error('payment_reconcile_identity_missing')
    }

    if (!providerRes.ok) {
      const normalized = normalizeTossApiFailure(providerRes)
      if (ownsClient) {
        await client.query('ROLLBACK')
      }
      return {
        outcome: 'provider_not_found',
        paymentId,
        providerCode: normalized.providerCode,
        httpStatus: providerRes.status,
      }
    }

    const paid = await finalizeReconciledTossPayment(client, {
      payment,
      tossPayment: providerRes.json,
      source: params.source ?? 'toss',
      periodAnchor: params.periodAnchor ?? null,
    })

    if (ownsClient) {
      await client.query('COMMIT')
    }
    return { outcome: 'reconciled', paymentId, ...paid }
  } catch (error) {
    if (ownsClient) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
    }
    if (isUniqueViolation(error)) {
      const err = new Error('provider_payment_key_conflict')
      err.cause = error
      throw err
    }
    throw error
  } finally {
    if (ownsClient) {
      client.release()
    }
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ olderThanMs?: number; limit?: number }} [params]
 */
export async function reconcileStalePendingInsurancePayments(pool, params = {}) {
  const olderThanMs = Math.max(60_000, Number(params.olderThanMs ?? 2 * 60_000))
  const limit = Math.max(1, Math.min(100, Number(params.limit ?? 20)))
  const cutoff = new Date(Date.now() - olderThanMs).toISOString()

  const pendingR = await systemQuery(
    pool,
    `
    SELECT id
    FROM billing_payments
    WHERE status = 'pending'
      AND provider = 'toss'
      AND order_id IS NOT NULL
      AND created_at <= $1
    ORDER BY created_at ASC
    LIMIT $2
    `,
    [cutoff, limit],
  )

  const summary = { scanned: pendingR.rowCount, reconciled: 0, stillPending: 0, failed: 0, items: [] }
  for (const row of pendingR.rows) {
    const paymentId = Number(row.id)
    try {
      const result = await reconcilePendingInsurancePayment(pool, { paymentId })
      if (result.outcome === 'reconciled' || result.outcome === 'already_paid') {
        summary.reconciled += 1
      } else {
        summary.stillPending += 1
      }
      summary.items.push({ paymentId, outcome: result.outcome })
    } catch (error) {
      summary.failed += 1
      summary.items.push({
        paymentId,
        outcome: 'error',
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return summary
}
