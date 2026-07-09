import { resolveCustomerBirthDateYmd } from '../lib/customerBirthDateResolve.js'
import { calculateInternationalAge, TA_ADULT_MIN_AGE } from '../lib/taCallAdult.js'

export const SMS_AUTOMATION_MINOR_EXCLUDE_REASON = '미성년자 제외'
export const SMS_AUTOMATION_AGE_UNKNOWN_NOTE = '나이 계산 불가'

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
 * @param {{ birthDate?: unknown; birth_date?: unknown; ssn?: unknown } | null | undefined} customer
 * @param {string} referenceDateYmd YYYY-MM-DD
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
 * @param {Record<string, unknown>} previewItem
 * @param {{ birthDate?: unknown; birth_date?: unknown; ssn?: unknown } | null | undefined} customer
 * @param {string} referenceDateYmd
 * @param {SmsAutomationTargetFilters} filters
 */
export function applyAutomationTargetScopeToPreviewItem(
  previewItem,
  customer,
  referenceDateYmd,
  filters,
) {
  const scope = evaluateAutomationTargetScope(customer, referenceDateYmd, filters)
  if (scope.excluded) {
    return {
      ...previewItem,
      sendable: false,
      excludedReason: scope.excludedReason,
      scopeNote: scope.scopeNote,
    }
  }
  return {
    ...previewItem,
    scopeNote: scope.scopeNote ?? previewItem.scopeNote ?? null,
  }
}
