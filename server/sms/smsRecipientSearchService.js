import {
  formatGenderLabel,
  formatLocalYmd,
  getSangnyeongDday,
  normalizeCustomerGender,
  resolveCustomerInsuranceMetrics,
} from '../../shared/customerInsuranceMetrics.js'
import {
  matchesCustomerTargetFilters,
  matchesTargetGender,
  parseOptionalFilterInt,
} from '../../shared/customerTargetFilters.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { isValidKoreanMobilePhone, normalizeSmsPhone } from './smsPhone.js'
import { loadOptOutPhoneSet } from './smsScope.js'

const MAX_SEARCH_RESULTS = 5000

function parseOptionalInt(value) {
  return parseOptionalFilterInt(value)
}

function normalizeBirthYmd(row) {
  const metrics = resolveCustomerInsuranceMetrics(row)
  if (metrics.birthDateYmd) {
    return metrics.birthDateYmd
  }
  if (row?.birth_date) {
    const d = row.birth_date instanceof Date ? row.birth_date : new Date(row.birth_date)
    if (!Number.isNaN(d.getTime())) {
      return formatLocalYmd(d)
    }
  }
  return null
}

function matchesSearch(row, search) {
  const q = String(search ?? '').trim()
  if (!q) {
    return true
  }
  const lower = q.toLowerCase()
  const name = String(row.name ?? '').toLowerCase()
  const phone = String(row.phone ?? '').replace(/\D/g, '')
  const birthYmd = normalizeBirthYmd(row) ?? ''
  return name.includes(lower) || phone.includes(q.replace(/\D/g, '')) || birthYmd.includes(q)
}

function matchesGender(row, genderFilter) {
  return matchesTargetGender(row, genderFilter)
}

function matchesSangnyeong(row, sangnyeongDays, today = new Date()) {
  return matchesCustomerTargetFilters(
    row,
    { gender: 'all', sangnyeongDays, insuranceAgeFrom: null, insuranceAgeTo: null },
    today,
  )
}

function matchesInsuranceAge(row, from, to, today = new Date()) {
  return matchesCustomerTargetFilters(
    row,
    { gender: 'all', sangnyeongDays: null, insuranceAgeFrom: from, insuranceAgeTo: to },
    today,
  )
}

function buildEligibility(row, optOutSet) {
  const phone = normalizeSmsPhone(row.phone)
  if (!phone) {
    return { canSend: false, blockedReason: 'no_phone' }
  }
  if (!isValidKoreanMobilePhone(phone)) {
    return { canSend: false, blockedReason: 'invalid_phone' }
  }
  if (optOutSet.has(phone)) {
    return { canSend: false, blockedReason: 'opt_out' }
  }
  return { canSend: true, blockedReason: null }
}

function mapCustomerRow(row, optOutSet, today = new Date()) {
  const metrics = resolveCustomerInsuranceMetrics(row, today)
  const gender = normalizeCustomerGender(row.gender)
  const birthDate = normalizeBirthYmd(row)
  const sangnyeongDday = metrics.maturityYmd ? getSangnyeongDday(metrics.maturityYmd, today) : null
  const eligibility = buildEligibility(row, optOutSet)
  const phone = normalizeSmsPhone(row.phone)

  return {
    customerId: Number(row.id),
    name: String(row.name ?? '').trim(),
    gender,
    genderLabel: formatGenderLabel(gender),
    birthDate,
    phone: phone || null,
    phoneDisplay: phone || '-',
    insuranceAge: metrics.insuranceAge,
    sangnyeongDday,
    sangnyeongLabel:
      sangnyeongDday == null
        ? '-'
        : sangnyeongDday === 0
          ? '상령일 D-0'
          : `상령일 D-${sangnyeongDday}`,
    canSend: eligibility.canSend,
    blockedReason: eligibility.blockedReason,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {{
 *   search?: string;
 *   gender?: string;
 *   sangnyeongDays?: string | number;
 *   insuranceAgeFrom?: string | number;
 *   insuranceAgeTo?: string | number;
 * }} query
 */
export async function searchSmsRecipientCustomers(executor, scope, query = {}) {
  const genderFilter =
    query.gender === 'male' || query.gender === 'female' ? query.gender : 'all'
  const today = new Date()

  const r = await systemQuery(
    executor,
    `
    SELECT c.id, c.name, c.phone, c.gender, c.ssn, c.insurance_age, c.next_age_date, c.birth_date
    FROM customers c
    INNER JOIN users u ON u.id = c.user_id
    INNER JOIN tenants t ON t.legacy_ga_id = u.ga_id
    WHERE c.user_id = $1 AND t.id = $2
    ORDER BY c.id ASC
    LIMIT $3
    `,
    [scope.userId, scope.tenantId, MAX_SEARCH_RESULTS],
  )

  const phones = r.rows.map((row) => normalizeSmsPhone(row.phone)).filter(Boolean)
  const optOutSet = await loadOptOutPhoneSet(executor, { tenantId: scope.tenantId, phones })

  const filtered = []
  for (const row of r.rows) {
    if (!matchesSearch(row, query.search)) {
      continue
    }
    if (!matchesGender(row, genderFilter)) {
      continue
    }
    if (!matchesSangnyeong(row, query.sangnyeongDays, today)) {
      continue
    }
    if (!matchesInsuranceAge(row, query.insuranceAgeFrom, query.insuranceAgeTo, today)) {
      continue
    }
    filtered.push(mapCustomerRow(row, optOutSet, today))
  }

  return {
    customers: filtered,
    totalCount: filtered.length,
    filteredCount: filtered.length,
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string }} scope
 * @param {number[]} customerIds
 */
export async function loadSmsRecipientCustomersByIds(executor, scope, customerIds) {
  const ids = [...new Set(customerIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
  if (ids.length === 0) {
    return []
  }

  const r = await systemQuery(
    executor,
    `
    SELECT c.id, c.name, c.phone, c.gender, c.ssn, c.insurance_age, c.next_age_date, c.birth_date
    FROM customers c
    INNER JOIN users u ON u.id = c.user_id
    INNER JOIN tenants t ON t.legacy_ga_id = u.ga_id
    WHERE c.user_id = $1 AND t.id = $2 AND c.id = ANY($3::int[])
    ORDER BY c.id ASC
    `,
    [scope.userId, scope.tenantId, ids],
  )

  const phones = r.rows.map((row) => normalizeSmsPhone(row.phone)).filter(Boolean)
  const optOutSet = await loadOptOutPhoneSet(executor, { tenantId: scope.tenantId, phones })
  const today = new Date()
  return r.rows.map((row) => mapCustomerRow(row, optOutSet, today))
}

export function mergeRecipientSelections(existing, incoming, options = {}) {
  const seenCustomerIds = new Set(existing.map((item) => item.customerId))
  const seenPhones = new Set(
    existing
      .map((item) => normalizeSmsPhone(item.phone))
      .filter(Boolean),
  )

  const added = []
  const skipped = {
    already_added: 0,
    duplicate_phone: 0,
    no_phone: 0,
    invalid_phone: 0,
    opt_out: 0,
  }

  for (const item of incoming) {
    if (seenCustomerIds.has(item.customerId)) {
      skipped.already_added += 1
      continue
    }

    const phone = normalizeSmsPhone(item.phone)
    if (phone && seenPhones.has(phone)) {
      skipped.duplicate_phone += 1
      continue
    }

    let blockedReason = item.blockedReason
    let canSend = item.canSend
    if (!phone) {
      blockedReason = 'no_phone'
      canSend = false
      skipped.no_phone += 1
    } else if (!isValidKoreanMobilePhone(phone)) {
      blockedReason = 'invalid_phone'
      canSend = false
      skipped.invalid_phone += 1
    } else if (blockedReason === 'opt_out') {
      canSend = false
      skipped.opt_out += 1
    }

    seenCustomerIds.add(item.customerId)
    if (phone) {
      seenPhones.add(phone)
    }

    added.push({
      ...item,
      phone: phone || null,
      canSend: Boolean(canSend && !blockedReason),
      blockedReason: canSend ? null : blockedReason,
    })
  }

  return {
    recipients: [...existing, ...added],
    addedCount: added.length,
    skipped,
  }
}

export { MAX_SEARCH_RESULTS }
