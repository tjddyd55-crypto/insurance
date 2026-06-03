import { GENERAL_GA_CODE_CANONICAL } from '../lib/generalGa.js'
import {
  BILLING_PLANS,
  VAT_RATE,
  buildPlanDefinitionFromDbRow,
  calculateVatIncludedPrice,
  resolveBillingPlan,
} from '../lib/pricingPolicy.js'
import { assertValidBillingPlanCode } from './billingPlanCode.js'
import { systemQuery } from '../utils/dbSafeQuery.js'

const PLAN_ROW_SELECT = `
  code, name, amount, supply_amount, vat_rate, apply_vat, cycle, is_active,
  allows_referral_discount, description, created_at, updated_at
`

function mapPlanRowToAdminDto(row) {
  const plan = buildPlanDefinitionFromDbRow(row)
  return {
    planCode: plan.code,
    dbCode: plan.dbCode,
    label: plan.label,
    supplyAmount: plan.supplyAmount,
    vatAmount: plan.vatAmount,
    totalAmount: plan.totalAmount,
    vatRate: plan.vatRate,
    applyVat: row.apply_vat !== false,
    displayPrice: plan.displayPrice,
    displayPriceWithVatNote: plan.displayPriceWithVatNote,
    allowsReferralDiscount: plan.allowsReferralDiscount,
    isActive: row.is_active !== false,
    description: row.description ?? null,
    cycle: String(row.cycle ?? 'monthly'),
    gaUsageCount: Number(row.ga_usage_count ?? 0),
    userUsageCount: Number(row.user_usage_count ?? 0),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ activeOnly?: boolean }} [opts]
 */
export async function listBillingPlanRows(executor, opts = {}) {
  const activeOnly = opts.activeOnly === true
  const r = await systemQuery(
    executor,
    `
    SELECT
      bp.code,
      bp.name,
      bp.amount,
      bp.supply_amount,
      bp.vat_rate,
      bp.apply_vat,
      bp.cycle,
      bp.is_active,
      bp.allows_referral_discount,
      bp.description,
      bp.created_at,
      bp.updated_at,
      (
        SELECT COUNT(*)::int FROM ga_billing_settings gbs WHERE gbs.default_plan_code = bp.code
      ) AS ga_usage_count,
      (
        SELECT COUNT(*)::int FROM user_billing_settings ubs WHERE ubs.override_plan_code = bp.code
      ) AS user_usage_count
    FROM billing_plans bp
    ${activeOnly ? 'WHERE bp.is_active = true' : ''}
    ORDER BY bp.code ASC
    `,
  )
  return r.rows
}

/** @param {import('pg').Pool | import('pg').PoolClient} executor */
export async function listActiveBillingPlanRows(executor) {
  return listBillingPlanRows(executor, { activeOnly: true })
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ activeOnly?: boolean }} [opts]
 */
export async function listBillingPlansAdmin(executor, opts = {}) {
  const rows = await listBillingPlanRows(executor, opts)
  return rows.map(mapPlanRowToAdminDto)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} planCodeOrDbCode
 * @param {{ allowInactive?: boolean }} [options]
 */
export async function fetchBillingPlanRowByCode(executor, planCodeOrDbCode, options = {}) {
  const raw = String(planCodeOrDbCode ?? '').trim()
  if (!raw) {
    return null
  }
  const r = await systemQuery(
    executor,
    `
    SELECT ${PLAN_ROW_SELECT}
    FROM billing_plans
    WHERE code = $1
    LIMIT 1
    `,
    [raw],
  )
  const row = r.rows[0] ?? null
  if (!row) {
    return null
  }
  if (row.is_active === false && !options.allowInactive) {
    return null
  }
  return row
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} planCodeOrDbCode
 * @param {{ allowInactive?: boolean; requireActive?: boolean }} [options]
 */
export async function fetchBillingPlanDefinition(executor, planCodeOrDbCode, options = {}) {
  const raw = String(planCodeOrDbCode ?? '').trim()
  if (!raw) {
    return BILLING_PLANS.STANDARD_MONTHLY
  }
  const row = await fetchBillingPlanRowByCode(executor, raw, {
    allowInactive: options.allowInactive === true || options.requireActive === false,
  })
  if (row) {
    if (options.requireActive !== false && row.is_active === false) {
      throw new Error('inactive_billing_plan')
    }
    return buildPlanDefinitionFromDbRow(row)
  }
  return resolveBillingPlan(raw)
}

/**
 * @param {{
 *   code: string;
 *   name: string;
 *   supplyAmount: number;
 *   applyVat?: boolean;
 *   vatRate?: number;
 *   allowsReferralDiscount?: boolean;
 *   description?: string | null;
 *   isActive?: boolean;
 * }} body
 */
export function computeBillingPlanAmounts(body) {
  const supplyAmount = Math.max(Math.round(Number(body.supplyAmount) || 0), 0)
  if (supplyAmount <= 0) {
    throw new Error('invalid_supply_amount')
  }
  const applyVat = body.applyVat !== false
  const vatRate = applyVat ? Number(body.vatRate ?? VAT_RATE) || VAT_RATE : 0
  if (applyVat && vatRate > 0) {
    const priced = calculateVatIncludedPrice(supplyAmount, vatRate)
    return {
      supplyAmount: priced.supplyAmount,
      vatAmount: priced.vatAmount,
      totalAmount: priced.totalAmount,
      vatRate,
      applyVat: true,
    }
  }
  return {
    supplyAmount,
    vatAmount: 0,
    totalAmount: supplyAmount,
    vatRate: 0,
    applyVat: false,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {object} body
 */
export async function createBillingPlanAdmin(executor, body) {
  const code = assertValidBillingPlanCode(body.code)
  const name = String(body.name ?? '').trim()
  if (!name) {
    throw new Error('invalid_plan_name')
  }
  const dup = await systemQuery(executor, `SELECT 1 FROM billing_plans WHERE code = $1 LIMIT 1`, [code])
  if (dup.rowCount > 0) {
    throw new Error('duplicate_plan_code')
  }
  const amounts = computeBillingPlanAmounts(body)
  const allowsReferralDiscount = body.allowsReferralDiscount !== false
  const description = String(body.description ?? '').trim() || null
  const isActive = body.isActive !== false

  await systemQuery(
    executor,
    `
    INSERT INTO billing_plans (
      code, name, amount, supply_amount, vat_rate, apply_vat, cycle, is_active,
      allows_referral_discount, description
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'monthly', $7, $8, $9)
    `,
    [
      code,
      name,
      amounts.totalAmount,
      amounts.supplyAmount,
      amounts.vatRate,
      amounts.applyVat,
      isActive,
      allowsReferralDiscount,
      description,
    ],
  )

  const row = await fetchBillingPlanRowByCode(executor, code, { allowInactive: true })
  return mapPlanRowToAdminDto(row)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} code
 * @param {object} body
 */
export async function updateBillingPlanAdmin(executor, code, body) {
  const planCode = assertValidBillingPlanCode(code)
  const existing = await fetchBillingPlanRowByCode(executor, planCode, { allowInactive: true })
  if (!existing) {
    throw new Error('plan_not_found')
  }

  const name = body.name != null ? String(body.name).trim() : String(existing.name ?? '').trim()
  if (!name) {
    throw new Error('invalid_plan_name')
  }

  const supplyAmount =
    body.supplyAmount != null ? Math.round(Number(body.supplyAmount)) : Number(existing.supply_amount)
  const applyVat = body.applyVat != null ? body.applyVat !== false : existing.apply_vat !== false
  const vatRate =
    body.vatRate != null ? Number(body.vatRate) : Number(existing.vat_rate ?? VAT_RATE) || VAT_RATE
  const amounts = computeBillingPlanAmounts({
    supplyAmount,
    applyVat,
    vatRate,
  })

  const allowsReferralDiscount =
    body.allowsReferralDiscount != null
      ? body.allowsReferralDiscount !== false
      : existing.allows_referral_discount !== false
  const description =
    body.description != null ? String(body.description).trim() || null : existing.description ?? null
  const isActive = body.isActive != null ? body.isActive !== false : existing.is_active !== false

  await systemQuery(
    executor,
    `
    UPDATE billing_plans
    SET name = $2,
        amount = $3,
        supply_amount = $4,
        vat_rate = $5,
        apply_vat = $6,
        allows_referral_discount = $7,
        description = $8,
        is_active = $9,
        updated_at = NOW()
    WHERE code = $1
    `,
    [
      planCode,
      name,
      amounts.totalAmount,
      amounts.supplyAmount,
      amounts.vatRate,
      amounts.applyVat,
      allowsReferralDiscount,
      description,
      isActive,
    ],
  )

  const row = await fetchBillingPlanRowByCode(executor, planCode, { allowInactive: true })
  return mapPlanRowToAdminDto(row)
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} code
 * @param {boolean} isActive
 */
export async function setBillingPlanActiveAdmin(executor, code, isActive) {
  const planCode = assertValidBillingPlanCode(code)
  const existing = await fetchBillingPlanRowByCode(executor, planCode, { allowInactive: true })
  if (!existing) {
    throw new Error('plan_not_found')
  }

  const usage = await getBillingPlanUsageCounts(executor, planCode)
  await systemQuery(
    executor,
    `
    UPDATE billing_plans
    SET is_active = $2, updated_at = NOW()
    WHERE code = $1
    `,
    [planCode, Boolean(isActive)],
  )
  const row = await fetchBillingPlanRowByCode(executor, planCode, { allowInactive: true })
  return {
    plan: mapPlanRowToAdminDto(row),
    usage,
    warning:
      !isActive && (usage.gaCount > 0 || usage.userCount > 0)
        ? '이 요금제를 사용 중인 GA 또는 사용자가 있습니다. 신규 선택만 제한됩니다.'
        : null,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} code
 */
export async function getBillingPlanUsageCounts(executor, code) {
  const planCode = String(code ?? '').trim()
  const gaR = await systemQuery(
    executor,
    `SELECT COUNT(*)::int AS c FROM ga_billing_settings WHERE default_plan_code = $1`,
    [planCode],
  )
  const userR = await systemQuery(
    executor,
    `SELECT COUNT(*)::int AS c FROM user_billing_settings WHERE override_plan_code = $1`,
    [planCode],
  )
  return {
    gaCount: Number(gaR.rows[0]?.c ?? 0),
    userCount: Number(userR.rows[0]?.c ?? 0),
  }
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
    const effectivePlanCode =
      defaultPlanCode ??
      (await getGeneralGaDefaultPlanCode(executor)) ??
      BILLING_PLANS.STANDARD_MONTHLY.dbCode
    const plan = await fetchBillingPlanDefinition(executor, effectivePlanCode, {
      allowInactive: true,
      requireActive: false,
    })
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
      planIsActive: plan.isActive !== false,
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
  const plan = await fetchBillingPlanDefinition(executor, planCode, { requireActive: true })
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
      effectivePlanIsActive: resolved.plan.isActive !== false,
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
  const plan = await fetchBillingPlanDefinition(executor, planCode, { requireActive: true })
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
