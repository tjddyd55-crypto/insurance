import { cellToImportString } from './normalize.js'
import { isKnownCustomerImportField } from './fieldDictionary.js'

/**
 * @param {unknown[]} rawRow
 * @param {string[]} headers
 * @param {Record<string, string>} columnMapping col_N → fieldKey
 */
export function mapRawRowToCustomerFields(rawRow, headers, columnMapping) {
  const mapped = {}
  const row = Array.isArray(rawRow) ? rawRow : []
  for (let colIndex = 0; colIndex < headers.length; colIndex += 1) {
    const colId = `col_${colIndex}`
    const fieldKey = columnMapping[colId]
    if (!fieldKey || !isKnownCustomerImportField(fieldKey)) {
      continue
    }
    mapped[fieldKey] = cellToImportString(row[colIndex])
  }
  return mapped
}
