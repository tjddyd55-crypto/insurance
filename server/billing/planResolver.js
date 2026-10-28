import {
  fetchBillingPlanDefinition,
  fetchInsuranceBasicPlanDefinition,
  getGaDefaultPlanCode,
} from './billingPlanService.js'
import { systemQuery } from '../utils/dbSafeQuery.js'

/** @typedef {'explicit' | 'user_override' | 'ga_default' | 'system_default'} BillingPlanSource */

const INSURANCE_BASIC_PLAN_CODE = 'insurance_basic'

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
    const plan = await fetchBillingPlanDefinition(executor, explicit, { requireActive: true })
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
    const plan = await fetchInsuranceBasicPlanDefinition(executor)
    return {
      planCode: plan.dbCode,
      planKey: plan.key,
      plan,
      source: 'system_default',
    }
  }

  const assignedPlanOptions = { allowInactive: true, requireActive: false }

  if (userRow.override_plan_code) {
    const plan = await fetchBillingPlanDefinition(
      executor,
      String(userRow.override_plan_code),
      assignedPlanOptions,
    )
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
      const plan = await fetchBillingPlanDefinition(executor, gaPlanCode, assignedPlanOptions)
      return {
        planCode: plan.dbCode,
        planKey: plan.key,
        plan,
        source: 'ga_default',
      }
    }
  }

  const plan = await fetchInsuranceBasicPlanDefinition(executor)
  return {
    planCode: plan.dbCode,
    planKey: plan.key,
    plan,
    source: 'system_default',
  }
}
