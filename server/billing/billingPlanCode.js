export const BILLING_PLAN_CODE_PATTERN = /^[a-z0-9_]+$/

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeBillingPlanCode(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function assertValidBillingPlanCode(raw) {
  const code = normalizeBillingPlanCode(raw)
  if (!code || !BILLING_PLAN_CODE_PATTERN.test(code)) {
    throw new Error('invalid_plan_code')
  }
  if (code.length > 64) {
    throw new Error('invalid_plan_code')
  }
  return code
}
