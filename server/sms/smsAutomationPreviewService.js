import { resolveCustomerBirthDateYmd } from '../lib/customerBirthDateResolve.js'
import { addDaysToDateOnly, formatDateOnly, getKstDateString } from '../../shared/dateTimeKst.js'
import { resolveCustomerInsuranceMetrics } from '../../shared/customerInsuranceMetrics.js'
import { isValidKoreanMobilePhone, normalizeSmsPhone } from './smsPhone.js'
import { loadOptOutPhoneSet } from './smsScope.js'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { mapRowToApi } from './smsAutomationRuleService.js'
import {
  applyAutomationTargetScopeToPreviewItem,
  mapAutomationTargetFiltersFromRuleRow,
} from './smsAutomationTargetFilter.js'
import { enrichPreviewItemForExecution } from './smsAutomationDedupe.js'

const TRIGGER_LABELS = {
  BIRTHDAY: '생일',
  CAR_INSURANCE_EXPIRY: '자동차보험 만기',
  INSURANCE_AGE: '보험나이',
  CUSTOMER_SPECIAL_DATE: '고객 지정 기념일',
}

const TEMPLATE_VAR_PATTERN = /\{([^}]+)\}/g

function normalizeBaseDate(raw) {
  const value = formatDateOnly(raw) || getKstDateString()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const err = new Error('sms_automation_preview_base_date_invalid')
    err.status = 400
    err.publicMessage = '기준일은 YYYY-MM-DD 형식이어야 합니다.'
    throw err
  }
  return value
}

export function computeAutomationTargetDate(baseDate, dayOffset) {
  return addDaysToDateOnly(baseDate, Number(dayOffset) || 0)
}

export function extractMonthDayFromYmd(ymd) {
  const value = formatDateOnly(ymd)
  if (!value) {
    return null
  }
  const [, month, day] = value.split('-')
  return `${month}-${day}`
}

export function matchesMonthDayReference(referenceYmd, targetYmd) {
  const ref = extractMonthDayFromYmd(referenceYmd)
  const target = extractMonthDayFromYmd(targetYmd)
  return ref != null && target != null && ref === target
}

export function formatAutomationDdayLabel(dayOffset) {
  const n = Number(dayOffset) || 0
  if (n === 0) {
    return '당일'
  }
  return `D-${n}`
}

function formatBirthdayForTargetYear(birthYmd, targetYmd) {
  const birthMd = extractMonthDayFromYmd(birthYmd)
  const target = formatDateOnly(targetYmd)
  if (!birthMd || !target) {
    return ''
  }
  const year = target.slice(0, 4)
  return `${year}-${birthMd}`
}

async function loadRuleById(executor, scope, ruleId) {
  const r = await systemQuery(
    executor,
    `
    SELECT *
    FROM sms_automation_rules
    WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND deleted_at IS NULL
  `,
    [ruleId, scope.tenantId, scope.userId],
  )
  return r.rows[0] ?? null
}

async function loadAgentProfile(executor, userId) {
  const r = await systemQuery(
    executor,
    `
    SELECT
      COALESCE(NULLIF(TRIM(display_name), ''), NULLIF(TRIM(name), ''), username, '') AS agent_name,
      COALESCE(NULLIF(TRIM(phone_number), ''), '') AS agent_phone
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId],
  )
  return {
    agentName: String(r.rows[0]?.agent_name ?? '').trim(),
    agentPhone: String(r.rows[0]?.agent_phone ?? '').trim(),
  }
}

function buildVariableMap(context) {
  return {
    고객명: String(context.customerName ?? '').trim(),
    담당자명: String(context.agentName ?? '').trim(),
    담당자연락처: String(context.agentPhone ?? '').trim(),
    기준일: String(context.referenceDate ?? '').trim(),
    'D일': String(context.dDayLabel ?? '').trim(),
    생일: String(context.birthdayDate ?? '').trim(),
    만기일: String(context.expiryDate ?? '').trim(),
    차량번호: String(context.carNumber ?? '').trim(),
    보험회사: String(context.insuranceCompany ?? '').trim(),
    보험나이: context.insuranceAge != null ? String(context.insuranceAge) : '',
    보험나이변경일: String(context.insuranceAgeChangeDate ?? '').trim(),
    기념일명: String(context.specialDateTitle ?? '').trim(),
    타이틀: String(context.specialDateTitle ?? '').trim(),
    기념일날짜: String(context.specialDateDate ?? '').trim(),
  }
}

export function renderAutomationMessage(template, context) {
  const vars = buildVariableMap(context)
  const usedTokens = new Set()
  for (const match of String(template ?? '').matchAll(TEMPLATE_VAR_PATTERN)) {
    usedTokens.add(match[1])
  }

  const missing = []
  for (const token of usedTokens) {
    const value = vars[token]
    if (value == null || String(value).trim() === '') {
      missing.push(token)
    }
  }

  let messageBody = String(template ?? '')
  for (const [key, value] of Object.entries(vars)) {
    messageBody = messageBody.replaceAll(`{${key}}`, value || '')
  }

  return { messageBody, missingVariables: missing }
}

function evaluatePhoneEligibility(phone, optOutSet) {
  const normalized = normalizeSmsPhone(phone)
  if (!normalized) {
    return { sendable: false, excludedReason: '휴대폰번호 없음', phone: '' }
  }
  if (!isValidKoreanMobilePhone(normalized)) {
    return { sendable: false, excludedReason: '휴대폰번호 없음', phone: normalized }
  }
  if (optOutSet.has(normalized)) {
    return { sendable: false, excludedReason: '수신거부 고객', phone: normalized }
  }
  return { sendable: true, excludedReason: null, phone: normalized }
}

function finalizePreviewItem(baseItem, template, context, optOutSet) {
  const phoneCheck = evaluatePhoneEligibility(baseItem.rawPhone, optOutSet)
  const renderContext = {
    ...context,
    customerName: baseItem.customerName,
    agentName: context.agentName,
    agentPhone: context.agentPhone,
  }
  const rendered = renderAutomationMessage(template, renderContext)

  let sendable = phoneCheck.sendable
  let excludedReason = phoneCheck.excludedReason

  if (!String(template ?? '').trim()) {
    sendable = false
    excludedReason = '문자 내용 없음'
  } else if (rendered.missingVariables.length > 0) {
    sendable = false
    excludedReason = `변수 치환 실패: ${rendered.missingVariables.join(', ')}`
  }

  return {
    customerId: baseItem.customerId,
    customerName: baseItem.customerName,
    phone: phoneCheck.phone,
    triggerLabel: baseItem.triggerLabel,
    referenceTitle: baseItem.referenceTitle ?? null,
    referenceDate: baseItem.referenceDate ?? null,
    dayOffset: baseItem.dayOffset,
    messageBody: rendered.messageBody,
    sendable,
    excludedReason,
    scopeNote: null,
    carNumber: baseItem.carNumber ?? null,
  }
}

async function loadScopedCustomers(executor, scope) {
  const r = await systemQuery(
    executor,
    `
    SELECT
      c.id,
      c.name,
      c.phone,
      c.ssn,
      c.birth_date,
      c.insurance_age,
      c.next_age_date,
      c.sms_opt_out
    FROM customers c
    INNER JOIN users u ON u.id = c.user_id
    INNER JOIN tenants t ON t.legacy_ga_id = u.ga_id
    WHERE c.user_id = $1
      AND t.id = $2
      AND c.deleted_at IS NULL
    ORDER BY c.id ASC
    `,
    [scope.userId, scope.tenantId],
  )
  return r.rows
}

async function collectBirthdayCandidates(executor, scope, targetDate) {
  const customers = await loadScopedCustomers(executor, scope)
  const items = []
  for (const row of customers) {
    const birthYmd = resolveCustomerBirthDateYmd(row)
    if (!birthYmd || !matchesMonthDayReference(birthYmd, targetDate)) {
      continue
    }
    items.push({
      customerId: Number(row.id),
      customerName: String(row.name ?? '').trim() || '고객',
      rawPhone: row.phone,
      triggerLabel: TRIGGER_LABELS.BIRTHDAY,
      referenceTitle: '생일',
      referenceDate: formatBirthdayForTargetYear(birthYmd, targetDate),
      birthdayDate: formatBirthdayForTargetYear(birthYmd, targetDate),
    })
  }
  return items
}

async function collectCarExpiryCandidates(executor, scope, targetDate) {
  const r = await systemQuery(
    executor,
    `
    SELECT
      c.id AS customer_id,
      c.name AS customer_name,
      c.phone,
      cc.id AS car_id,
      cc.car_number,
      cc.renewal_date
    FROM customer_cars cc
    INNER JOIN customers c ON c.id = cc.customer_id
    INNER JOIN users u ON u.id = c.user_id
    INNER JOIN tenants t ON t.legacy_ga_id = u.ga_id
    WHERE c.user_id = $1
      AND t.id = $2
      AND c.deleted_at IS NULL
      AND cc.renewal_date = $3::date
    ORDER BY c.id ASC, cc.is_primary DESC, cc.id ASC
    `,
    [scope.userId, scope.tenantId, targetDate],
  )

  const items = r.rows.map((row) => ({
    customerId: Number(row.customer_id),
    customerName: String(row.customer_name ?? '').trim() || '고객',
    rawPhone: row.phone,
    referenceId: Number(row.car_id),
    triggerLabel: TRIGGER_LABELS.CAR_INSURANCE_EXPIRY,
    referenceTitle: String(row.car_number ?? '').trim() || '자동차보험',
    referenceDate: formatDateOnly(row.renewal_date),
    expiryDate: formatDateOnly(row.renewal_date),
    carNumber: String(row.car_number ?? '').trim(),
    insuranceCompany: '',
  }))

  if (items.length > 0) {
    return items
  }

  const fallback = await systemQuery(
    executor,
    `
    SELECT c.id AS customer_id, c.name AS customer_name, c.phone, c.car_number, c.renewal_date
    FROM customers c
    INNER JOIN users u ON u.id = c.user_id
    INNER JOIN tenants t ON t.legacy_ga_id = u.ga_id
    WHERE c.user_id = $1
      AND t.id = $2
      AND c.deleted_at IS NULL
      AND c.renewal_date = $3::date
    ORDER BY c.id ASC
    `,
    [scope.userId, scope.tenantId, targetDate],
  )

  return fallback.rows.map((row) => ({
    customerId: Number(row.customer_id),
    customerName: String(row.customer_name ?? '').trim() || '고객',
    rawPhone: row.phone,
    referenceId: null,
    triggerLabel: TRIGGER_LABELS.CAR_INSURANCE_EXPIRY,
    referenceTitle: String(row.car_number ?? '').trim() || '자동차보험',
    referenceDate: formatDateOnly(row.renewal_date),
    expiryDate: formatDateOnly(row.renewal_date),
    carNumber: String(row.car_number ?? '').trim(),
    insuranceCompany: '',
  }))
}

async function collectInsuranceAgeCandidates(executor, scope, targetDate) {
  const customers = await loadScopedCustomers(executor, scope)
  const items = []
  const seen = new Set()

  for (const row of customers) {
    const metrics = resolveCustomerInsuranceMetrics(row, new Date(`${targetDate}T12:00:00`))
    const changeDate = metrics.maturityYmd || formatDateOnly(row.next_age_date)
    if (!changeDate || changeDate !== targetDate) {
      continue
    }
    const key = `${row.id}:${changeDate}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    items.push({
      customerId: Number(row.id),
      customerName: String(row.name ?? '').trim() || '고객',
      rawPhone: row.phone,
      triggerLabel: TRIGGER_LABELS.INSURANCE_AGE,
      referenceTitle: '보험나이',
      referenceDate: changeDate,
      insuranceAge: metrics.insuranceAge,
      insuranceAgeChangeDate: changeDate,
    })
  }

  return items
}

async function collectSpecialDateCandidates(executor, scope, targetDate, purposeType) {
  const params = [scope.userId, scope.tenantId]
  let purposeClause = ''
  if (purposeType && purposeType !== 'ALL') {
    params.push(purposeType)
    purposeClause = `AND sd.purpose_type = $${params.length}`
  }

  const r = await systemQuery(
    executor,
    `
    SELECT
      c.id AS customer_id,
      c.name AS customer_name,
      c.phone,
      sd.id AS special_date_id,
      sd.title,
      sd.date_value,
      sd.purpose_type
    FROM customer_special_dates sd
    INNER JOIN customers c ON c.id = sd.customer_id
    INNER JOIN users u ON u.id = c.user_id
    INNER JOIN tenants t ON t.legacy_ga_id = u.ga_id
    WHERE c.user_id = $1
      AND t.id = $2
      AND c.deleted_at IS NULL
      AND sd.deleted_at IS NULL
      AND sd.user_id = $1
      AND EXTRACT(MONTH FROM sd.date_value) = EXTRACT(MONTH FROM $${params.length + 1}::date)
      AND EXTRACT(DAY FROM sd.date_value) = EXTRACT(DAY FROM $${params.length + 1}::date)
      ${purposeClause}
    ORDER BY c.id ASC, sd.sort_order ASC, sd.id ASC
    `,
    [...params, targetDate],
  )

  return r.rows.map((row) => {
    const specialDate = formatBirthdayForTargetYear(formatDateOnly(row.date_value), targetDate)
    return {
      customerId: Number(row.customer_id),
      customerName: String(row.customer_name ?? '').trim() || '고객',
      rawPhone: row.phone,
      referenceId: Number(row.special_date_id),
      triggerLabel: TRIGGER_LABELS.CUSTOMER_SPECIAL_DATE,
      referenceTitle: String(row.title ?? '').trim() || '기념일',
      referenceDate: specialDate,
      specialDateTitle: String(row.title ?? '').trim(),
      specialDateDate: specialDate,
    }
  })
}

async function collectCandidates(executor, scope, rule, targetDate) {
  switch (rule.triggerType) {
    case 'BIRTHDAY':
      return collectBirthdayCandidates(executor, scope, targetDate)
    case 'CAR_INSURANCE_EXPIRY':
      return collectCarExpiryCandidates(executor, scope, targetDate)
    case 'INSURANCE_AGE':
      return collectInsuranceAgeCandidates(executor, scope, targetDate)
    case 'CUSTOMER_SPECIAL_DATE':
      return collectSpecialDateCandidates(
        executor,
        scope,
        targetDate,
        rule.specialDatePurposeType ?? 'ALL',
      )
    default:
      return []
  }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} executor
 * @param {{ tenantId: number; userId: string; gaId?: number | null }} scope
 * @param {number} ruleId
 * @param {{ baseDate?: string | null }} [options]
 */
export async function previewAutomationRule(executor, scope, ruleId, options = {}) {
  const existing = await loadRuleById(executor, scope, ruleId)
  if (!existing) {
    const err = new Error('sms_automation_rule_not_found')
    err.status = 404
    err.publicMessage = '자동문자 규칙을 찾을 수 없습니다.'
    throw err
  }

  const rule = mapRowToApi(existing)
  const targetFilters = mapAutomationTargetFiltersFromRuleRow(existing)
  const baseDate = normalizeBaseDate(options.baseDate)
  const targetDate = computeAutomationTargetDate(baseDate, rule.dayOffset)
  const agent = await loadAgentProfile(executor, scope.userId)
  const rawCandidates = await collectCandidates(executor, scope, rule, targetDate)
  const customerById = new Map(
    (await loadScopedCustomers(executor, scope)).map((row) => [Number(row.id), row]),
  )

  const phones = rawCandidates.map((item) => normalizeSmsPhone(item.rawPhone)).filter(Boolean)
  const optOutSet = await loadOptOutPhoneSet(executor, { tenantId: scope.tenantId, phones })

  const items = rawCandidates.map((candidate) => {
    const finalized = finalizePreviewItem(
      { ...candidate, dayOffset: rule.dayOffset },
      rule.messageBody,
      {
        agentName: agent.agentName,
        agentPhone: agent.agentPhone,
        referenceDate: candidate.referenceDate ?? targetDate,
        dDayLabel: formatAutomationDdayLabel(rule.dayOffset),
        birthdayDate: candidate.birthdayDate,
        expiryDate: candidate.expiryDate,
        carNumber: candidate.carNumber,
        insuranceCompany: candidate.insuranceCompany,
        insuranceAge: candidate.insuranceAge,
        insuranceAgeChangeDate: candidate.insuranceAgeChangeDate,
        specialDateTitle: candidate.specialDateTitle,
        specialDateDate: candidate.specialDateDate,
      },
      optOutSet,
    )
    const scoped = applyAutomationTargetScopeToPreviewItem(
      finalized,
      customerById.get(candidate.customerId) ?? null,
      baseDate,
      targetFilters,
    )
    return enrichPreviewItemForExecution(scoped, candidate, rule.triggerType)
  })

  const sendableCount = items.filter((item) => item.sendable).length

  return {
    rule: {
      id: rule.id,
      ruleName: rule.ruleName,
      triggerType: rule.triggerType,
      dayOffset: rule.dayOffset,
      sendTime: rule.sendTime,
      isActive: rule.isActive,
      excludeMinors: rule.excludeMinors,
    },
    baseDate,
    targetDate,
    summary: {
      total: items.length,
      sendable: sendableCount,
      excluded: items.length - sendableCount,
    },
    items,
    previewAvailable: true,
  }
}

export {
  TRIGGER_LABELS,
  normalizeBaseDate,
  buildVariableMap,
  evaluatePhoneEligibility,
  loadScopedCustomers,
}
