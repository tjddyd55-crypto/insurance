/**
 * @typedef {Object} TaTargetFilterSettings
 * @property {'all' | 'male' | 'female'} [targetGender]
 * @property {number | null} [targetSangnyeongDays]
 * @property {number | null} [targetInsuranceAgeMin]
 * @property {number | null} [targetInsuranceAgeMax]
 * @property {boolean} [excludeMinors]
 */

/**
 * @param {TaTargetFilterSettings | null | undefined} settings
 * @returns {boolean}
 */
export function hasTaTargetFilterConditions(settings) {
  if (!settings) {
    return false
  }
  if (settings.targetGender && settings.targetGender !== 'all') {
    return true
  }
  if (settings.targetSangnyeongDays != null) {
    return true
  }
  if (settings.targetInsuranceAgeMin != null || settings.targetInsuranceAgeMax != null) {
    return true
  }
  if (settings.excludeMinors === false) {
    return true
  }
  return false
}

/**
 * @param {TaTargetFilterSettings | null | undefined} settings
 * @returns {string}
 */
export function buildTaTargetFilterSummary(settings) {
  if (!hasTaTargetFilterConditions(settings)) {
    return '전체 고객 대상'
  }

  /** @type {string[]} */
  const parts = []
  if (settings?.targetGender === 'male') {
    parts.push('남성')
  } else if (settings?.targetGender === 'female') {
    parts.push('여성')
  }

  if (settings?.targetSangnyeongDays != null) {
    parts.push(`상령일 ${settings.targetSangnyeongDays}일 이내`)
  }

  const min = settings?.targetInsuranceAgeMin
  const max = settings?.targetInsuranceAgeMax
  if (min != null && max != null) {
    parts.push(`보험나이 ${min}~${max}세`)
  } else if (min != null) {
    parts.push(`보험나이 ${min}세 이상`)
  } else if (max != null) {
    parts.push(`보험나이 ${max}세 이하`)
  }

  if (settings?.excludeMinors === false) {
    parts.push('미성년 포함')
  } else {
    parts.push('미성년 제외')
  }

  return parts.join(' · ')
}
