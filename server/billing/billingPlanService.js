import { GENERAL_GA_CODE_CANONICAL } from '../lib/generalGa.js'
import {
  BILLING_PLANS,
  buildPlanDefinitionFromDbRow,
  resolveBillingPlan,
} from '../lib/pricingPolicy.js'
import { systemQuery } from '../utils/dbSafeQuery.js'

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function listActiveBillingPlanRows(executor) {
  const r = await systemQuery(
    executor,
    `
    SELECT code, name, amount, cycle, is_active, allows_referral_discount
    FROM billing_plans
    WHERE is_active = true
    ORDER BY code ASC
    `,
  )
  return r.rows
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function listBillingPlansAdmin(executor) {
  const rows = await listActiveBillingPlanRows(executor)
  return rows.map((row) => {
    const plan = buildPlanDefinitionFromDbRow(row)
    return {
      planCode: plan.code,
      dbCode: plan.dbCode,
      label: plan.label,
      supplyAmount: plan.supplyAmount,
      vatAmount: plan.vatAmount,
      totalAmount: plan.totalAmount,
      displayPrice: plan.displayPrice,
      displayPriceWithVatNote: plan.displayPriceWithVatNote,
      allowsReferralDiscount: plan.allowsReferralDiscount,
      cycle: String(row.cycle ?? 'monthly'),
    }
  })
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} planCodeOrDbCode
 */
export async function fetchBillingPlanDefinition(executor, planCodeOrDbCode) {
  const raw = String(planCodeOrDbCode ?? '').trim()
  if (!raw) {
    return BILLING_PLANS.STANDARD_MONTHLY
  }
  const r = await systemQuery(
    executor,
    `
    SELECT code, name, amount, cycle, is_active, allows_referral_discount
    FROM billing_plans
    WHERE code = $1 AND is_active = true
    LIMIT 1
    `,
    [raw],
  )
  if (r.rows[0]) {
    return buildPlanDefinitionFromDbRow(r.rows[0])
  }
  return resolveBillingPlan(raw)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {number} gaId
 */
export async function getGaDefaultPlanCode(executor, gaId) {
  const r = await systemQuery(
    executor,
    `
    SELECT default_plan_code
    FROM ga_billing_settings
    WHERE ga_id = $1
    LIMIT 1
    `,
    [gaId],
  )
  return r.rows[0]?.default_plan_code ? String(r.rows[0].default_plan_code) : null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function getGeneralGaDefaultPlanCode(executor) {
  const r = await systemQuery(
    executor,
    `
    SELECT gbs.default_plan_code
    FROM ga_companies gc
    INNER JOIN ga_billing_settings gbs ON gbs.ga_id = gc.id
    WHERE UPPER(TRIM(gc.code)) = $1
      AND gc.is_deleted = false
    LIMIT 1
    `,
    [GENERAL_GA_CODE_CANONICAL],
  )
  return r.rows[0]?.default_plan_code ? String(r.rows[0].default_plan_code) : null
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function listGaBillingPlansAdmin(executor) {
  const r = await systemQuery(
    executor,
    `
    SELECT
      gc.id,
      gc.name,
      gc.code,
      gbs.default_plan_code,
      COUNT(u.id)::int AS user_count
    FROM ga_companies gc
    LEFT JOIN ga_billing_settings gbs ON gbs.ga_id = gc.id
    LEFT JOIN users u ON u.ga_id = gc.id AND u.is_deleted = false
    WHERE gc.is_deleted = false
    GROUP BY gc.id, gc.name, gc.code, gbs.default_plan_code
    ORDER BY gc.code ASC
    `,
  )

  const rows = []
  for (const row of r.rows) {
    const defaultPlanCode = row.default_plan_code ? String(row.default_plan_code) : null
    const effectivePlanCode = defaultPlanCode ?? (await getGeneralGaDefaultPlanCode(executor)) ?? BILLING_PLANS.STANDARD_MONTHLY.dbCode
    const plan = await fetchBillingPlanDefinition(executor, effectivePlanCode)
    rows.push({
      gaId: Number(row.id),
      gaName: String(row.name ?? ''),
      gaCode: String(row.code ?? ''),
      defaultPlanCode,
      effectivePlanCode: plan.dbCode,
      planLabel: plan.label,
      supplyAmount: plan.supplyAmount,
      vatAmount: plan.vatAmount,
      totalAmount: plan.totalAmount,
      displayPriceWithVatNote: plan.displayPriceWithVatNote,
      userCount: Number(row.user_count ?? 0),
      usesGeneralFallback: !defaultPlanCode,
    })
  }
  return rows
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {number} gaId
 * @param {string} planCode
 */
export async function updateGaDefaultBillingPlan(executor, gaId, planCode) {
  const gaR = await systemQuery(
    executor,
    `SELECT id FROM ga_companies WHERE id = $1 AND is_deleted = false LIMIT 1`,
    [gaId],
  )
  if (gaR.rowCount === 0) {
    throw new Error('ga_not_found')
  }
  const plan = await fetchBillingPlanDefinition(executor, planCode)
  await systemQuery(
    executor,
    `
    INSERT INTO ga_billing_settings (ga_id, default_plan_code)
    VALUES ($1, $2)
    ON CONFLICT (ga_id) DO UPDATE
      SET default_plan_code = EXCLUDED.default_plan_code,
          updated_at = NOW()
    `,
    [gaId, plan.dbCode],
  )
  return { gaId, defaultPlanCode: plan.dbCode, planLabel: plan.label }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 */
export async function listBillingUsersAdmin(executor) {
  const r = await systemQuery(
    executor,
    `
    SELECT
      u.id,
      COALESCE(NULLIF(TRIM(u.display_name), ''), u.username) AS user_name,
      u.username,
      gc.id AS ga_id,
      gc.code AS ga_code,
      gc.name AS ga_name,
      gbs.default_plan_code AS ga_default_plan_code,
      ubs.override_plan_code,
      bs.status AS subscription_status,
      (
        SELECT pi.plan_code
        FROM payment_invoices pi
        WHERE pi.user_id = u.id
        ORDER BY pi.created_at DESC, pi.id DESC
        LIMIT 1
      ) AS latest_invoice_plan_code,
      (
        SELECT pi.final_amount
        FROM payment_invoices pi
        WHERE pi.user_id = u.id
        ORDER BY pi.created_at DESC, pi.id DESC
        LIMIT 1
      ) AS latest_invoice_amount,
      (
        SELECT pi.status
        FROM payment_invoices pi
        WHERE pi.user_id = u.id
        ORDER BY pi.created_at DESC, pi.id DESC
        LIMIT 1
      ) AS latest_invoice_status
    FROM users u
    INNER JOIN ga_companies gc ON gc.id = u.ga_id
    LEFT JOIN ga_billing_settings gbs ON gbs.ga_id = gc.id
    LEFT JOIN user_billing_settings ubs ON ubs.user_id = u.id
    LEFT JOIN billing_subscriptions bs ON bs.user_id = u.id
    WHERE u.is_deleted = false
    ORDER BY u.username ASC
    LIMIT 500
    `,
  )

  const { resolveBillingPlanForUser } = await import('./planResolver.js')
  const rows = []
  for (const row of r.rows) {
    const resolved = await resolveBillingPlanForUser(executor, String(row.id))
    const gaDefaultPlanCode =
      row.ga_default_plan_code != null
        ? String(row.ga_default_plan_code)
        : resolved.source === 'general_default'
          ? resolved.planCode
          : null
    rows.push({
      userId: String(row.id),
      userName: String(row.user_name ?? row.username ?? ''),
      gaId: Number(row.ga_id),
      gaCode: String(row.ga_code ?? ''),
      gaName: String(row.ga_name ?? ''),
      gaDefaultPlanCode,
      userOverridePlanCode: row.override_plan_code ? String(row.override_plan_code) : null,
      effectivePlanCode: resolved.planCode,
      effectivePlanSource: resolved.source,
      effectivePlanLabel: resolved.plan.label,
      supplyAmount: resolved.plan.supplyAmount,
      vatAmount: resolved.plan.vatAmount,
      totalAmount: resolved.plan.totalAmount,
      displayPriceWithVatNote: resolved.plan.displayPriceWithVatNote,
      subscriptionStatus: String(row.subscription_status ?? 'none'),
      latestInvoicePlanCode: row.latest_invoice_plan_code ? String(row.latest_invoice_plan_code) : null,
      latestInvoiceAmount: row.latest_invoice_amount != null ? Number(row.latest_invoice_amount) : null,
      latestInvoiceStatus: row.latest_invoice_status ? String(row.latest_invoice_status) : null,
    })
  }
  return rows
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @param {string | null} planCode null 이면 사용자 예외 해제
 */
export async function updateUserBillingPlanOverride(executor, userId, planCode) {
  const userR = await systemQuery(
    executor,
    `SELECT id FROM users WHERE id = $1 AND is_deleted = false LIMIT 1`,
    [userId],
  )
  if (userR.rowCount === 0) {
    throw new Error('user_not_found')
  }
  if (planCode == null || String(planCode).trim() === '') {
    await systemQuery(executor, `DELETE FROM user_billing_settings WHERE user_id = $1`, [userId])
    const resolved = await (await import('./planResolver.js')).resolveBillingPlanForUser(executor, userId)
    return {
      userId,
      userOverridePlanCode: null,
      effectivePlanCode: resolved.planCode,
      effectivePlanSource: resolved.source,
    }
  }
  const plan = await fetchBillingPlanDefinition(executor, planCode)
  await systemQuery(
    executor,
    `
    INSERT INTO user_billing_settings (user_id, override_plan_code)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE
      SET override_plan_code = EXCLUDED.override_plan_code,
          updated_at = NOW()
    `,
    [userId, plan.dbCode],
  )
  return {
    userId,
    userOverridePlanCode: plan.dbCode,
    effectivePlanCode: plan.dbCode,
    effectivePlanSource: 'user_override',
  }
}
