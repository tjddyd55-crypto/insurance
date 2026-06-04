/**
 * 고객 검색 결과 dedupe — id 1순위, name+phone+birth/ssn 동일 시 1명으로 축소.
 * 신청서(PDF) 고객 검색·GET /customers/search 공용.
 */

/** @param {unknown} value */
export function normalizePhoneForCustomerDedupe(value) {
  return String(value ?? '').replace(/\D/g, '')
}

/** @param {unknown} value */
export function normalizeNameForCustomerDedupe(value) {
  return String(value ?? '').trim().toLowerCase()
}

/**
 * @param {{ birthDate?: unknown; birth_date?: unknown; ssn?: unknown }} customer
 */
export function normalizeBirthOrSsnPrefix(customer) {
  const bdRaw = customer.birthDate ?? customer.birth_date
  const bd = typeof bdRaw === 'string' ? bdRaw.trim() : ''
  if (bd) {
    const ymd = bd.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      return ymd
    }
  }
  const ssn = String(customer.ssn ?? '').replace(/\D/g, '')
  if (ssn.length >= 6) {
    return ssn.slice(0, 6)
  }
  if (ssn.length >= 7) {
    return ssn.slice(0, 7)
  }
  return ''
}

/**
 * name + normalizedPhone + birth/ssn prefix 가 모두 있을 때만 identity key 생성.
 * @param {Record<string, unknown>} customer
 */
export function getCustomerSearchIdentityKey(customer) {
  const phone = normalizePhoneForCustomerDedupe(customer.phone ?? customer.phoneNumber ?? customer.phone_number)
  const name = normalizeNameForCustomerDedupe(customer.name)
  if (!name || phone.length < 10) {
    return null
  }
  const birthPart = normalizeBirthOrSsnPrefix(customer)
  if (!birthPart) {
    return null
  }
  return `${phone}:${name}:${birthPart}`
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 */
export function compareCustomerSearchPreference(a, b) {
  const consultA = Date.parse(String(a.lastConsultDate ?? a.last_consult_date ?? '')) || 0
  const consultB = Date.parse(String(b.lastConsultDate ?? b.last_consult_date ?? '')) || 0
  if (consultA !== consultB) {
    return consultB - consultA
  }

  const appA = a.hasAppLink === true || a.appLinked === true ? 1 : 0
  const appB = b.hasAppLink === true || b.appLinked === true ? 1 : 0
  if (appA !== appB) {
    return appB - appA
  }

  const createdA = Date.parse(String(a.createdAt ?? a.created_at ?? '')) || 0
  const createdB = Date.parse(String(b.createdAt ?? b.created_at ?? '')) || 0
  if (createdA !== createdB) {
    return createdA - createdB
  }

  const idA = Number(a.id) || 0
  const idB = Number(b.id) || 0
  return idA - idB
}

/**
 * @template T extends { id?: unknown }
 * @param {T[]} rows
 */
export function dedupeCustomersById(rows) {
  const seen = new Set()
  /** @type {T[]} */
  const out = []
  for (const row of rows) {
    const id = Number(row.id)
    if (!Number.isInteger(id) || id < 1) {
      continue
    }
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    out.push(row)
  }
  return out
}

/**
 * @template T extends Record<string, unknown>
 * @param {T[]} rows
 */
export function dedupeCustomersForSearch(rows) {
  const beforeCount = rows.length
  const byId = dedupeCustomersById(rows)

  /** @type {Map<string, T[]>} */
  const groups = new Map()
  /** @type {T[]} */
  const standalone = []

  for (const row of byId) {
    const key = getCustomerSearchIdentityKey(row)
    if (!key) {
      standalone.push(row)
      continue
    }
    const bucket = groups.get(key) ?? []
    bucket.push(row)
    groups.set(key, bucket)
  }

  /** @type {T[]} */
  const picked = [...standalone]
  for (const group of groups.values()) {
    if (group.length === 1) {
      picked.push(group[0])
      continue
    }
    const sorted = [...group].sort(compareCustomerSearchPreference)
    picked.push(sorted[0])
  }

  return {
    customers: picked,
    meta: {
      beforeCount,
      afterCount: picked.length,
      idDeduped: beforeCount !== byId.length,
      identityDeduped: byId.length !== picked.length,
    },
  }
}
