import { CUSTOMER_IMPORT_REASON } from './constants.js'
import { normalizeImportPhone, normalizeImportString } from './normalize.js'

function identityKey(name, phone) {
  const n = normalizeImportString(name).toLowerCase()
  const p = normalizeImportPhone(phone).normalized
  if (!n || !p) {
    return null
  }
  return `${p}:${n}`
}

/**
 * @param {Array<{ rowId: string, mapped: Record<string, string> }>} rows
 */
export function findInFileDuplicateFlags(rows) {
  const byKey = new Map()
  const flags = new Map()
  for (const row of rows) {
    const key = identityKey(row.mapped.name, row.mapped.phone)
    if (!key) {
      continue
    }
    if (!byKey.has(key)) {
      byKey.set(key, [])
    }
    byKey.get(key).push(row.rowId)
  }
  for (const ids of byKey.values()) {
    if (ids.length > 1) {
      for (const id of ids) {
        flags.set(id, CUSTOMER_IMPORT_REASON.DUPLICATE_IN_FILE)
      }
    }
  }
  return flags
}

/**
 * @param {Record<string, string>} mapped
 * @param {{ byPhone: Map<string, number[]>, byName: Map<string, number[]> }} crmIndex
 */
export function classifyCrmDuplicate(mapped, crmIndex) {
  const phone = normalizeImportPhone(mapped.phone).normalized
  const name = normalizeImportString(mapped.name).toLowerCase()
  if (phone && crmIndex.byPhone.has(phone)) {
    return {
      kind: 'STRONG',
      reason: CUSTOMER_IMPORT_REASON.DUPLICATE_EXISTING_CUSTOMER,
      customerIds: crmIndex.byPhone.get(phone) ?? [],
    }
  }
  if (name && crmIndex.byName.has(name)) {
    return {
      kind: 'WEAK',
      reason: CUSTOMER_IMPORT_REASON.DUPLICATE_POSSIBLE_NAME,
      customerIds: crmIndex.byName.get(name) ?? [],
    }
  }
  return null
}
