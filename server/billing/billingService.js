import { randomUUID } from 'node:crypto'
import { MONTHLY_BASIC_PLAN_CODE } from './policy.js'
import { calculateInvoicePricing, getDefaultBillingPlan } from './pricing.js'
import { resolveBillingPlanForUser } from './planResolver.js'
import { calculateVatIncludedPrice } from '../lib/pricingPolicy.js'
import { calculateDiscountedTotalAmount } from '../lib/pricingPolicy.js'
import { getPaymentSettingsPublic } from './paymentSettings.js'
import { systemQuery } from '../utils/dbSafeQuery.js'

const MS_PER_DAY = 86400000

function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 */
export async function getBillingMe(executor, userId) {
  const settings = await getPaymentSettingsPublic(executor)
  const subR = await systemQuery(
    executor,
    `
    SELECT id, plan_code, status, current_period_start, current_period_end, next_billing_at, updated_at
    FROM billing_subscriptions
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId],
  )
  const sub = subR.rows[0] ?? null
  const userR = await systemQuery(
    executor,
    `
    SELECT subscription_plan, subscription_started_at, subscription_expires_at, role
    FROM users
    WHERE id = $1 AND is_deleted = false
    LIMIT 1
    `,
    [userId],
  )
  const userRow = userR.rows[0] ?? null
  const defaultPlan = getDefaultBillingPlan()

  return {
    paymentMode: settings.mode,
    paymentProvider: settings.provider,
    isVirtualMode: settings.mode === 'virtual',
    planCode: sub?.plan_code ?? MONTHLY_BASIC_PLAN_CODE,
    subscriptionStatus: sub?.status ?? 'none',
    currentPeriodStart: sub?.current_period_start ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    nextBillingAt: sub?.next_billing_at ?? null,
    accessPlan: userRow?.subscription_plan ?? 'FREE',
    accessExpiresAt: userRow?.subscription_expires_at ?? null,
    standardPlan: {
      label: defaultPlan.label,
      supplyAmount: defaultPlan.supplyAmount,
      vatAmount: defaultPlan.vatAmount,
      totalAmount: defaultPlan.totalAmount,
      displayPrice: defaultPlan.displayPrice,
      displayPriceWithVatNote: defaultPlan.displayPriceWithVatNote,
    },
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @param {{ limit?: number }} [opts]
 */
export async function listInvoicesForUser(executor, userId, opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit ?? 20) || 20, 1), 100)
  const r = await systemQuery(
    executor,
    `
    SELECT
      id, plan_code, base_amount, referral_discount_amount, referee_first_month_discount_amount,
      promotion_code_id, promotion_discount_amount,
      discount_amount, final_amount, status, billing_period_start, billing_period_end,
      due_at, paid_at, created_at
    FROM payment_invoices
    WHERE user_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT $2
    `,
    [userId, limit],
  )
  return r.rows.map(mapInvoiceRow)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ userId?: string; limit?: number }} [opts]
 */
export async function listInvoicesAdmin(executor, opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit ?? 50) || 50, 1), 200)
  const userId = String(opts.userId ?? '').trim()
  const params = [limit]
  let where = ''
  if (userId) {
    where = 'WHERE pi.user_id = $2'
    params.unshift(userId)
    params[0] = limit
    params[1] = userId
  }
  const r = await systemQuery(
    executor,
    `
    SELECT
      pi.id, pi.user_id, u.display_name, u.username,
      pi.plan_code, pi.base_amount, pi.referral_discount_amount, pi.referee_first_month_discount_amount,
      pi.promotion_code_id, pi.promotion_discount_amount,
      pi.discount_amount, pi.final_amount, pi.status, pi.billing_period_start, pi.billing_period_end,
      pi.due_at, pi.paid_at, pi.created_at
    FROM payment_invoices pi
    INNER JOIN users u ON u.id = pi.user_id
    ${where}
    ORDER BY pi.created_at DESC, pi.id DESC
    LIMIT $1
    `,
    userId ? [limit, userId] : [limit],
  )
  return r.rows.map((row) => ({
    ...mapInvoiceRow(row),
    userId: String(row.user_id),
    userName: String(row.display_name ?? '').trim() || String(row.username ?? ''),
  }))
}

function mapInvoiceRow(row) {
  const baseAmountStored = Number(row.base_amount ?? 0)
  const finalAmountStored = Number(row.final_amount ?? 0)
  const referralDiscountAmount = Number(row.referral_discount_amount ?? 0)
  const refereeFirstMonthDiscountAmount = Number(row.referee_first_month_discount_amount ?? 0)
  const promotionDiscountAmount = Number(row.promotion_discount_amount ?? 0)
  const promotionCodeId = row.promotion_code_id == null ? null : Number(row.promotion_code_id)
  const discountAmountStored = Number(row.discount_amount ?? 0)

  const isLegacySupplyPricing =
    baseAmountStored > 0 && baseAmountStored <= 8000 && finalAmountStored <= baseAmountStored

  if (isLegacySupplyPricing) {
    const legacyPriced = calculateVatIncludedPrice(finalAmountStored)
    return {
      id: Number(row.id),
      planCode: String(row.plan_code ?? MONTHLY_BASIC_PLAN_CODE),
      baseSupplyAmount: baseAmountStored,
      baseAmount: calculateVatIncludedPrice(baseAmountStored).totalAmount,
      vatAmount: legacyPriced.vatAmount,
      referralDiscountAmount,
      refereeFirstMonthDiscountAmount,
      promotionCodeId,
      promotionDiscountAmount,
      discountAmount: calculateVatIncludedPrice(baseAmountStored).totalAmount - legacyPriced.totalAmount,
      finalSupplyAmount: finalAmountStored,
      finalAmount: legacyPriced.totalAmount,
      status: String(row.status ?? 'pending'),
      billingPeriodStart: row.billing_period_start ?? null,
      billingPeriodEnd: row.billing_period_end ?? null,
      dueAt: row.due_at ?? null,
      paidAt: row.paid_at ?? null,
      createdAt: row.created_at ?? null,
      isLegacySupplyPricing: true,
    }
  }

  const supplyDiscountAmount = referralDiscountAmount + refereeFirstMonthDiscountAmount + promotionDiscountAmount
  const defaultPlan = getDefaultBillingPlan()
  const baseSupplyAmount =
    baseAmountStored === defaultPlan.totalAmount
      ? defaultPlan.supplyAmount
      : calculateVatIncludedPrice(Math.max(baseAmountStored - discountAmountStored, 0)).supplyAmount
  const priced = calculateVatIncludedPrice(Math.max(baseSupplyAmount - supplyDiscountAmount, 0))

  return {
    id: Number(row.id),
    planCode: String(row.plan_code ?? MONTHLY_BASIC_PLAN_CODE),
    baseSupplyAmount,
    baseAmount: baseAmountStored,
    vatAmount: priced.vatAmount,
    referralDiscountAmount,
    refereeFirstMonthDiscountAmount,
    promotionCodeId,
    promotionDiscountAmount,
    discountAmount: discountAmountStored,
    finalSupplyAmount: priced.supplyAmount,
    finalAmount: finalAmountStored,
    status: String(row.status ?? 'pending'),
    billingPeriodStart: row.billing_period_start ?? null,
    billingPeriodEnd: row.billing_period_end ?? null,
    dueAt: row.due_at ?? null,
    paidAt: row.paid_at ?? null,
    createdAt: row.created_at ?? null,
    isLegacySupplyPricing: false,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @param {{ planCode?: string }} [options]
 */
export async function createPendingInvoice(executor, userId, options = {}) {
  const settings = await getPaymentSettingsPublic(executor)
  if (settings.mode === 'live' && !settings.isEnabled) {
    throw new Error('live_payment_not_enabled')
  }

  const pending = await systemQuery(
    executor,
    `
    SELECT id FROM payment_invoices
    WHERE user_id = $1 AND status = 'pending'
    LIMIT 1
    `,
    [userId],
  )
  if (pending.rowCount > 0) {
    throw new Error('pending_invoice_exists')
  }

  const resolved = await resolveBillingPlanForUser(executor, userId, {
    explicitPlanCode: options.planCode,
  })
  const pricing = await calculateInvoicePricing(executor, userId, { resolvedPlan: resolved })
  const now = new Date()
  const periodStart = now
  const periodEnd = addDays(now, 30)
  const dueAt = addDays(now, 7)

  const ins = await systemQuery(
    executor,
    `
    INSERT INTO payment_invoices (
      user_id,
      plan_code,
      base_amount,
      referral_discount_amount,
      referee_first_month_discount_amount,
      promotion_code_id,
      promotion_discount_amount,
      discount_amount,
      final_amount,
      status,
      billing_period_start,
      billing_period_end,
      due_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11, $12)
    RETURNING id
    `,
    [
      userId,
      pricing.planCode,
      pricing.baseAmount,
      pricing.referralDiscountAmount,
      pricing.refereeFirstMonthDiscountAmount,
      pricing.promotionCodeId,
      pricing.promotionDiscountAmount,
      pricing.discountAmount,
      pricing.finalAmount,
      periodStart,
      periodEnd,
      dueAt,
    ],
  )

  const invoiceId = Number(ins.rows[0].id)

  if (pricing.promotionCodeId != null && Number(pricing.promotionDiscountAmount ?? 0) > 0) {
    const baseTotal = calculateDiscountedTotalAmount(pricing.baseSupplyAmount, 0).totalAmount
    const promoOnlyTotal = calculateDiscountedTotalAmount(
      pricing.baseSupplyAmount,
      Number(pricing.promotionDiscountAmount ?? 0),
    ).totalAmount
    const promoDiscountTotal = Math.max(baseTotal - promoOnlyTotal, 0)
    await systemQuery(
      executor,
      `
      INSERT INTO promotion_code_redemptions (
        promotion_code_id,
        user_id,
        invoice_id,
        original_amount,
        discount_amount,
        final_amount,
        applied_month_index
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        pricing.promotionCodeId,
        userId,
        invoiceId,
        pricing.baseAmount,
        promoDiscountTotal,
        pricing.finalAmount,
        Math.max(1, Number(pricing.promotionMonthIndex ?? 1) || 1),
      ],
    )
  }

  const rows = await listInvoicesForUser(executor, userId, { limit: 1 })
  const created = rows.find((row) => row.id === invoiceId) ?? rows[0]
  return { invoice: created, pricing, planSource: resolved.source, paymentMode: settings.mode }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} invoiceId
 * @param {string} actorUserId
 */
export async function completeMockPayment(client, invoiceId, actorUserId) {
  const settings = await getPaymentSettingsPublic(client)
  if (settings.mode !== 'virtual') {
    throw new Error('mock_pay_virtual_only')
  }

  const invR = await systemQuery(
    client,
    `
    SELECT *
    FROM payment_invoices
    WHERE id = $1
    LIMIT 1
    FOR UPDATE
    `,
    [invoiceId],
  )
  const invoice = invR.rows[0]
  if (!invoice) {
    throw new Error('invoice_not_found')
  }
  if (String(invoice.status) !== 'pending') {
    throw new Error('invoice_not_pending')
  }

  const userId = String(invoice.user_id)
  const now = new Date()
  const periodStart = invoice.billing_period_start ?? now
  const periodEnd = invoice.billing_period_end ?? addDays(now, 30)
  const mockTxId = `mock_${randomUUID().replace(/-/g, '').slice(0, 20)}`

  await systemQuery(
    client,
    `
    UPDATE payment_invoices
    SET status = 'paid', paid_at = NOW(), updated_at = NOW()
    WHERE id = $1
    `,
    [invoiceId],
  )

  await systemQuery(
    client,
    `
    INSERT INTO payment_transactions (
      invoice_id, provider, mode, provider_transaction_id, amount, status, raw_response
    )
    VALUES ($1, $2, 'virtual', $3, $4, 'paid', $5::jsonb)
    `,
    [
      invoiceId,
      settings.provider,
      mockTxId,
      Number(invoice.final_amount ?? 0),
      JSON.stringify({ mock: true, completedBy: actorUserId }),
    ],
  )

  await systemQuery(
    client,
    `
    INSERT INTO billing_subscriptions (
      user_id, plan_code, status, current_period_start, current_period_end, next_billing_at
    )
    VALUES ($1, $2, 'active', $3, $4, $4)
    ON CONFLICT (user_id) DO UPDATE
      SET plan_code = EXCLUDED.plan_code,
          status = 'active',
          current_period_start = EXCLUDED.current_period_start,
          current_period_end = EXCLUDED.current_period_end,
          next_billing_at = EXCLUDED.next_billing_at,
          updated_at = NOW()
    `,
    [userId, String(invoice.plan_code ?? MONTHLY_BASIC_PLAN_CODE), periodStart, periodEnd],
  )

  await systemQuery(
    client,
    `
    UPDATE users
    SET subscription_plan = 'PAID',
        subscription_started_at = COALESCE(subscription_started_at, $2),
        subscription_expires_at = GREATEST(COALESCE(subscription_expires_at, $3), $3)
    WHERE id = $1 AND is_deleted = false
    `,
    [userId, periodStart, periodEnd],
  )

  return {
    invoiceId,
    transactionId: mockTxId,
    userId,
    finalAmount: Number(invoice.final_amount ?? 0),
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ limit?: number }} [opts]
 */
export async function listBillingSubscriptionsAdmin(executor, opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit ?? 100) || 100, 1), 500)
  const r = await systemQuery(
    executor,
    `
    SELECT
      bs.id, bs.user_id, u.display_name, u.username,
      bs.plan_code, bs.status, bs.current_period_start, bs.current_period_end, bs.next_billing_at,
      u.subscription_plan, u.subscription_expires_at
    FROM billing_subscriptions bs
    INNER JOIN users u ON u.id = bs.user_id
    ORDER BY bs.updated_at DESC, bs.id DESC
    LIMIT $1
    `,
    [limit],
  )
  return r.rows.map((row) => ({
    id: Number(row.id),
    userId: String(row.user_id),
    userName: String(row.display_name ?? '').trim() || String(row.username ?? ''),
    planCode: String(row.plan_code ?? MONTHLY_BASIC_PLAN_CODE),
    status: String(row.status ?? 'none'),
    currentPeriodStart: row.current_period_start ?? null,
    currentPeriodEnd: row.current_period_end ?? null,
    nextBillingAt: row.next_billing_at ?? null,
    accessPlan: String(row.subscription_plan ?? 'FREE'),
    accessExpiresAt: row.subscription_expires_at ?? null,
  }))
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {number} subscriptionId
 * @param {string} status
 */
export async function updateBillingSubscriptionStatusAdmin(executor, subscriptionId, status) {
  const allowed = new Set(['none', 'trial', 'active', 'past_due', 'cancelled', 'expired'])
  if (!allowed.has(status)) {
    throw new Error('invalid_subscription_status')
  }
  const r = await systemQuery(
    executor,
    `
    UPDATE billing_subscriptions
    SET status = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING id, user_id, plan_code, status, current_period_start, current_period_end, next_billing_at
    `,
    [subscriptionId, status],
  )
  if (r.rowCount === 0) {
    throw new Error('subscription_not_found')
  }
  const row = r.rows[0]
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    planCode: String(row.plan_code),
    status: String(row.status),
    currentPeriodStart: row.current_period_start ?? null,
    currentPeriodEnd: row.current_period_end ?? null,
    nextBillingAt: row.next_billing_at ?? null,
  }
}
