import { resolveCustomerBirthDateYmd } from '../lib/customerBirthDateResolve.js'
import { calculateInternationalAge, TA_ADULT_MIN_AGE } from '../lib/taCallAdult.js'

export const SMS_AUTOMATION_MINOR_EXCLUDE_REASON = '미성년자 제외'
export const SMS_AUTOMATION_AGE_UNKNOWN_NOTE = '나이 계산 불가'
export const SMS_AUTOMATION_CUSTOMER_SMS_OPT_OUT_REASON = '문자 수신거부'

/**
 * @typedef {{ excludeMinors?: boolean }} SmsAutomationTargetFilters
 */

/**
 * @param {Record<string, unknown> | null | undefined} input
 * @returns {SmsAutomationTargetFilters}
 */
export function mapAutomationTargetFiltersFromInput(input) {
  return {
    excludeMinors: input?.excludeMinors === true || input?.exclude_minors === true,
  }
}

/**
 * @param {{ exclude_minors?: unknown } | null | undefined} row
 * @returns {SmsAutomationTargetFilters}
 */
export function mapAutomationTargetFiltersFromRuleRow(row) {
  return {
    excludeMinors: row?.exclude_minors === true,
  }
}

/**
 * 자동문자 대상 범위(미성년자 제외 등)를 평가한다.
 * preview·실제 발송 대상 계산에서 동일하게 사용한다.
 *
 * @param {{ birthDate?: unknown; birth_date?: unknown; ssn?: unknown } | null | undefined} customer
 * @param {string} referenceDateYmd YYYY-MM-DD (미리보기 기준일·발송 판정일)
 * @param {SmsAutomationTargetFilters} filters
 */
export function evaluateAutomationTargetScope(customer, referenceDateYmd, filters) {
  if (!filters?.excludeMinors) {
    return { excluded: false, excludedReason: null, scopeNote: null }
  }

  const birthYmd = resolveCustomerBirthDateYmd(customer)
  if (!birthYmd) {
    return {
      excluded: false,
      excludedReason: null,
      scopeNote: SMS_AUTOMATION_AGE_UNKNOWN_NOTE,
    }
  }

  const age = calculateInternationalAge(birthYmd, referenceDateYmd)
  if (age == null) {
    return {
      excluded: false,
      excludedReason: null,
      scopeNote: SMS_AUTOMATION_AGE_UNKNOWN_NOTE,
    }
  }

  if (age < TA_ADULT_MIN_AGE) {
    return {
      excluded: true,
      excludedReason: SMS_AUTOMATION_MINOR_EXCLUDE_REASON,
      scopeNote: null,
    }
  }

  return { excluded: false, excludedReason: null, scopeNote: null }
}

/**
 * @param {{ sms_opt_out?: unknown; smsOptOut?: unknown } | null | undefined} customer
 */
export function isCustomerSmsOptOut(customer) {
  return customer?.sms_opt_out === true || customer?.smsOptOut === true
}

/**
 * @param {Record<string, unknown>} previewItem
 * @param {{ sms_opt_out?: unknown; smsOptOut?: unknown } | null | undefined} customer
 */
export function applyCustomerSmsOptOutToPreviewItem(previewItem, customer) {
  if (!isCustomerSmsOptOut(customer)) {
    return previewItem
  }
  return {
    ...previewItem,
    sendable: false,
    excludedReason: SMS_AUTOMATION_CUSTOMER_SMS_OPT_OUT_REASON,
  }
}

/**
 * @param {Record<string, unknown>} previewItem
 * @param {{ birthDate?: unknown; birth_date?: unknown; ssn?: unknown; sms_opt_out?: unknown; smsOptOut?: unknown } | null | undefined} customer
 * @param {string} referenceDateYmd
 * @param {SmsAutomationTargetFilters} filters
 */
export function applyAutomationTargetScopeToPreviewItem(
  previewItem,
  customer,
  referenceDateYmd,
  filters,
) {
  const withSmsOptOut = applyCustomerSmsOptOutToPreviewItem(previewItem, customer)
  if (withSmsOptOut.sendable === false) {
    return withSmsOptOut
  }

  const scope = evaluateAutomationTargetScope(customer, referenceDateYmd, filters)
  if (scope.excluded) {
    return {
      ...withSmsOptOut,
      sendable: false,
      excludedReason: scope.excludedReason,
      scopeNote: scope.scopeNote,
    }
  }
  return {
    ...withSmsOptOut,
    scopeNote: scope.scopeNote ?? withSmsOptOut.scopeNote ?? null,
  }
}
