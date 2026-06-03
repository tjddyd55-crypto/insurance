import { BILLING_PLANS } from '../lib/pricingPolicy.js'
import {
  fetchBillingPlanDefinition,
  getGaDefaultPlanCode,
  getGeneralGaDefaultPlanCode,
} from './billingPlanService.js'
import { systemQuery } from '../utils/dbSafeQuery.js'

/** @typedef {'explicit' | 'user_override' | 'ga_default' | 'general_default' | 'system_default'} BillingPlanSource */

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {string} userId
 * @param {{ explicitPlanCode?: string | null }} [options]
 * @returns {Promise<{
 *   planCode: string;
 *   planKey: string;
 *   plan: ReturnType<typeof fetchBillingPlanDefinition> extends Promise<infer T> ? T : never;
 *   source: BillingPlanSource;
 * }>}
 */
export async function resolveBillingPlanForUser(executor, userId, options = {}) {
  const explicit = String(options.explicitPlanCode ?? '').trim()
  if (explicit) {
    const plan = await fetchBillingPlanDefinition(executor, explicit)
    return {
      planCode: plan.dbCode,
      planKey: plan.key,
      plan,
      source: 'explicit',
    }
  }

  const userR = await systemQuery(
    executor,
    `
    SELECT u.ga_id, ubs.override_plan_code
    FROM users u
    LEFT JOIN user_billing_settings ubs ON ubs.user_id = u.id
    WHERE u.id = $1 AND u.is_deleted = false
    LIMIT 1
    `,
    [userId],
  )
  const userRow = userR.rows[0]
  if (!userRow) {
    const plan = BILLING_PLANS.STANDARD_MONTHLY
    return {
      planCode: plan.dbCode,
      planKey: plan.key,
      plan,
      source: 'system_default',
    }
  }

  if (userRow.override_plan_code) {
    const plan = await fetchBillingPlanDefinition(executor, String(userRow.override_plan_code))
    return {
      planCode: plan.dbCode,
      planKey: plan.key,
      plan,
      source: 'user_override',
    }
  }

  const gaId = Number(userRow.ga_id)
  if (Number.isFinite(gaId) && gaId > 0) {
    const gaPlanCode = await getGaDefaultPlanCode(executor, gaId)
    if (gaPlanCode) {
      const plan = await fetchBillingPlanDefinition(executor, gaPlanCode)
      return {
        planCode: plan.dbCode,
        planKey: plan.key,
        plan,
        source: 'ga_default',
      }
    }
  }

  const generalPlanCode = await getGeneralGaDefaultPlanCode(executor)
  if (generalPlanCode) {
    const plan = await fetchBillingPlanDefinition(executor, generalPlanCode)
    return {
      planCode: plan.dbCode,
      planKey: plan.key,
      plan,
      source: 'general_default',
    }
  }

  const plan = BILLING_PLANS.STANDARD_MONTHLY
  return {
    planCode: plan.dbCode,
    planKey: plan.key,
    plan,
    source: 'system_default',
  }
}
