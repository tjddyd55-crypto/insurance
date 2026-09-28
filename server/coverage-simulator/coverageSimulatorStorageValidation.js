const DISEASE_TYPES = new Set([
  'cancer',
  'cerebrovascular',
  'heart',
  'care-dementia',
  'fracture-surgery',
  'custom',
])

const SCENARIO_CATEGORIES = new Set(['diagnosis', 'treatment', 'recovery', 'support', 'other'])

const MAX_TITLE_LEN = 200
const MAX_NAME_LEN = 200
const MAX_ITEMS = 500
const MAX_LABEL_LEN = 500
const MAX_MEMO_LEN = 4000
const MAX_AMOUNT = 1_000_000_000_000

/**
 * @param {unknown} value
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true; items: object[] } | { ok: false; message: string }}
 */
export function validateScenarioItemsJson(raw) {
  if (!Array.isArray(raw)) {
    return { ok: false, message: 'items는 배열이어야 합니다.' }
  }
  if (raw.length > MAX_ITEMS) {
    return { ok: false, message: `항목은 최대 ${MAX_ITEMS}개까지 가능합니다.` }
  }
  const items = []
  for (let i = 0; i < raw.length; i += 1) {
    const entry = raw[i]
    if (!entry || typeof entry !== 'object') {
      return { ok: false, message: `항목 ${i + 1} 형식이 올바르지 않습니다.` }
    }
    const type = String(entry.type ?? '').trim()
    const id = String(entry.id ?? '').trim()
    if (!id || id.length > 80) {
      return { ok: false, message: `항목 ${i + 1} id가 올바르지 않습니다.` }
    }
    const order = entry.order
    if (!Number.isInteger(order) || order < 0) {
      return { ok: false, message: `항목 ${i + 1} order가 올바르지 않습니다.` }
    }
    if (type === 'time-marker') {
      const label = String(entry.label ?? '').trim()
      if (!label || label.length > MAX_LABEL_LEN) {
        return { ok: false, message: `항목 ${i + 1} 라벨이 올바르지 않습니다.` }
      }
      items.push({ id, type: 'time-marker', label, order })
      continue
    }
    if (type !== 'coverage') {
      return { ok: false, message: `항목 ${i + 1} type이 올바르지 않습니다.` }
    }
    const category = String(entry.category ?? '').trim()
    if (!SCENARIO_CATEGORIES.has(category)) {
      return { ok: false, message: `항목 ${i + 1} category가 올바르지 않습니다.` }
    }
    const label = String(entry.label ?? '').trim()
    if (!label || label.length > MAX_LABEL_LEN) {
      return { ok: false, message: `항목 ${i + 1} 라벨이 올바르지 않습니다.` }
    }
    const currentAmount = entry.currentAmount
    const proposedAmount = entry.proposedAmount
    if (currentAmount !== null && currentAmount !== undefined && !isFiniteNumber(currentAmount)) {
      return { ok: false, message: `항목 ${i + 1} currentAmount가 올바르지 않습니다.` }
    }
    if (proposedAmount !== null && proposedAmount !== undefined && !isFiniteNumber(proposedAmount)) {
      return { ok: false, message: `항목 ${i + 1} proposedAmount가 올바르지 않습니다.` }
    }
    if (isFiniteNumber(currentAmount) && (currentAmount < 0 || currentAmount > MAX_AMOUNT)) {
      return { ok: false, message: `항목 ${i + 1} currentAmount 범위가 올바르지 않습니다.` }
    }
    if (isFiniteNumber(proposedAmount) && (proposedAmount < 0 || proposedAmount > MAX_AMOUNT)) {
      return { ok: false, message: `항목 ${i + 1} proposedAmount 범위가 올바르지 않습니다.` }
    }
    const memo = entry.memo != null ? String(entry.memo) : undefined
    if (memo != null && memo.length > MAX_MEMO_LEN) {
      return { ok: false, message: `항목 ${i + 1} memo가 너무 깁니다.` }
    }
    items.push({
      id,
      type: 'coverage',
      category,
      label,
      currentAmount: currentAmount ?? null,
      proposedAmount: proposedAmount ?? null,
      memo: memo?.trim() || undefined,
      order,
      favorite: entry.favorite === true ? true : undefined,
    })
  }
  return { ok: true, items }
}

/**
 * @param {unknown} diseaseType
 */
export function normalizeDiseaseType(diseaseType) {
  const v = String(diseaseType ?? 'custom').trim()
  return DISEASE_TYPES.has(v) ? v : null
}

/**
 * @param {object} body
 */
export function validateTemplatePayload(body) {
  const name = String(body?.name ?? '').trim()
  if (!name || name.length > MAX_NAME_LEN) {
    return { ok: false, code: 'COVERAGE_VALIDATION_FAILED', message: '시나리오 이름이 올바르지 않습니다.' }
  }
  const description = body?.description != null ? String(body.description) : ''
  if (description.length > 4000) {
    return { ok: false, code: 'COVERAGE_VALIDATION_FAILED', message: '설명이 너무 깁니다.' }
  }
  const diseaseType = normalizeDiseaseType(body?.diseaseType ?? 'custom')
  if (!diseaseType) {
    return { ok: false, code: 'COVERAGE_VALIDATION_FAILED', message: '질환 유형이 올바르지 않습니다.' }
  }
  const itemsResult = validateScenarioItemsJson(body?.items ?? [])
  if (!itemsResult.ok) {
    return { ok: false, code: 'COVERAGE_VALIDATION_FAILED', message: itemsResult.message }
  }
  return {
    ok: true,
    value: {
      name,
      description: description.trim(),
      diseaseType,
      items: itemsResult.items,
      legacyClientId: body?.legacyClientId != null ? String(body.legacyClientId).trim() || null : null,
    },
  }
}

/**
 * @param {object} body
 */
export function validateSimulationPayload(body, { partial = false } = {}) {
  const title = body?.title != null ? String(body.title).trim() : partial ? undefined : ''
  if (!partial && (!title || title.length > MAX_TITLE_LEN)) {
    return { ok: false, code: 'COVERAGE_VALIDATION_FAILED', message: '제목이 올바르지 않습니다.' }
  }
  if (partial && title !== undefined && (!title || title.length > MAX_TITLE_LEN)) {
    return { ok: false, code: 'COVERAGE_VALIDATION_FAILED', message: '제목이 올바르지 않습니다.' }
  }
  const diseaseTypeRaw = body?.diseaseType
  let diseaseType = undefined
  if (diseaseTypeRaw !== undefined) {
    diseaseType = normalizeDiseaseType(diseaseTypeRaw)
    if (!diseaseType) {
      return { ok: false, code: 'COVERAGE_VALIDATION_FAILED', message: '질환 유형이 올바르지 않습니다.' }
    }
  } else if (!partial) {
    return { ok: false, code: 'COVERAGE_VALIDATION_FAILED', message: '질환 유형이 필요합니다.' }
  }
  const description = body?.description != null ? String(body.description) : partial ? undefined : ''
  if (description !== undefined && description.length > 4000) {
    return { ok: false, code: 'COVERAGE_VALIDATION_FAILED', message: '설명이 너무 깁니다.' }
  }
  let items = undefined
  if (body?.items !== undefined) {
    const itemsResult = validateScenarioItemsJson(body.items)
    if (!itemsResult.ok) {
      return { ok: false, code: 'COVERAGE_VALIDATION_FAILED', message: itemsResult.message }
    }
    items = itemsResult.items
  } else if (!partial) {
    return { ok: false, code: 'COVERAGE_VALIDATION_FAILED', message: '항목이 필요합니다.' }
  }
  const consultationDateRaw = body?.consultationDate
  let consultationDate = undefined
  if (consultationDateRaw !== undefined) {
    const d = String(consultationDateRaw).trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return { ok: false, code: 'COVERAGE_VALIDATION_FAILED', message: '상담일 형식이 올바르지 않습니다.' }
    }
    consultationDate = d
  } else if (!partial) {
    return { ok: false, code: 'COVERAGE_VALIDATION_FAILED', message: '상담일이 필요합니다.' }
  }
  const customerId =
    body?.customerId === null || body?.customerId === undefined || body?.customerId === ''
      ? null
      : String(body.customerId).trim()
  if (customerId && customerId.length > 64) {
    return { ok: false, code: 'COVERAGE_VALIDATION_FAILED', message: '고객 ID가 올바르지 않습니다.' }
  }
  return {
    ok: true,
    value: {
      title,
      diseaseType,
      description: description !== undefined ? description.trim() : undefined,
      items,
      consultationDate,
      customerId,
      customerNameSnapshot:
        body?.customerNameSnapshot != null ? String(body.customerNameSnapshot).trim() || null : null,
      templateId: body?.templateId != null ? String(body.templateId).trim() || null : null,
      templateNameSnapshot:
        body?.templateNameSnapshot != null ? String(body.templateNameSnapshot).trim() || null : null,
      legacyClientId: body?.legacyClientId != null ? String(body.legacyClientId).trim() || null : null,
      clientUpdatedAt: body?.updatedAt != null ? String(body.updatedAt).trim() || null : null,
    },
  }
}
