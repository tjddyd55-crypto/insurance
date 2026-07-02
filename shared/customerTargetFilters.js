import {
  getSangnyeongDday,
  normalizeCustomerGender,
  resolveCustomerInsuranceMetrics,
} from './customerInsuranceMetrics.js'

export function parseOptionalFilterInt(value) {
  if (value == null || value === '') {
    return null
  }
  const n = Number.parseInt(String(value).trim(), 10)
  return Number.isFinite(n) ? n : null
}

export function matchesTargetGender(row, genderFilter) {
  if (!genderFilter || genderFilter === 'all') {
    return true
  }
  const normalized = normalizeCustomerGender(row?.gender)
  if (!normalized) {
    return false
  }
  return normalized === genderFilter
}

export function matchesTargetSangnyeong(row, sangnyeongDays, today = new Date()) {
  const maxDays = parseOptionalFilterInt(sangnyeongDays)
  if (maxDays == null) {
    return true
  }
  const metrics = resolveCustomerInsuranceMetrics(row, today)
  if (!metrics.maturityYmd) {
    return false
  }
  const dday = getSangnyeongDday(metrics.maturityYmd, today)
  if (dday == null) {
    return false
  }
  return dday >= 0 && dday <= maxDays
}

export function matchesTargetInsuranceAge(row, from, to, today = new Date()) {
  const min = parseOptionalFilterInt(from)
  const max = parseOptionalFilterInt(to)
  if (min == null && max == null) {
    return true
  }
  const metrics = resolveCustomerInsuranceMetrics(row, today)
  if (metrics.insuranceAge == null) {
    return false
  }
  if (min != null && metrics.insuranceAge < min) {
    return false
  }
  if (max != null && metrics.insuranceAge > max) {
    return false
  }
  return true
}

/**
 * @param {Record<string, unknown>} row
 * @param {{ gender?: string | null; sangnyeongDays?: number | null; insuranceAgeFrom?: number | null; insuranceAgeTo?: number | null }} filters
 * @param {Date} [today]
 */
export function matchesCustomerTargetFilters(row, filters, today = new Date()) {
  if (!matchesTargetGender(row, filters.gender ?? 'all')) {
    return false
  }
  if (!matchesTargetSangnyeong(row, filters.sangnyeongDays, today)) {
    return false
  }
  if (!matchesTargetInsuranceAge(row, filters.insuranceAgeFrom, filters.insuranceAgeTo, today)) {
    return false
  }
  return true
}
