import { TABLE_ORDER } from './constants.js'

export function createIdMaps() {
  return Object.fromEntries(TABLE_ORDER.map((table) => [table, new Map()]))
}

export function recordIdMapping(idMaps, table, oldId, newId) {
  if (oldId == null || newId == null) return
  idMaps[table].set(String(oldId), newId)
}

export function mappedId(idMaps, table, oldId, { optional = false } = {}) {
  if (oldId == null) return null
  const mapped = idMaps[table]?.get(String(oldId))
  if (mapped == null && !optional) {
    throw new Error(`${table} ID 매핑이 없습니다: ${oldId}`)
  }
  return mapped ?? null
}

export function remapRelationRow(row, idMaps) {
  return {
    ...row,
    customer_id: mappedId(idMaps, 'customers', row.customer_id),
    related_customer_id: mappedId(idMaps, 'customers', row.related_customer_id),
  }
}

export function remapTodoCustomerReferences(row, idMaps) {
  const oldId = row.related_entity_id ?? row.source_id
  const newId = mappedId(idMaps, 'customers', oldId, { optional: true })
  if (newId == null) return row
  const metadata = { ...(row.metadata ?? {}) }
  if ('customerId' in metadata) metadata.customerId = newId
  if ('customer_id' in metadata) metadata.customer_id = newId
  return {
    ...row,
    related_entity_id: row.related_entity_id == null ? null : String(newId),
    source_id: row.source_id == null ? null : String(newId),
    metadata,
  }
}
