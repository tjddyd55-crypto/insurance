import { CUSTOMER_IMPORT_DUPLICATE_POLICY, CUSTOMER_IMPORT_ROW_STATUS } from '../../../shared/ai-assistant/customer-import/constants.js'
import { classifyCrmDuplicate, findInFileDuplicateFlags } from '../../../shared/ai-assistant/customer-import/duplicate.js'
import { buildImportPreviewSummary, computePreviewVersionHash } from '../../../shared/ai-assistant/customer-import/preview.js'
import { mapRawRowToCustomerFields } from '../../../shared/ai-assistant/customer-import/rowMapping.js'
import { validateMappedCustomerRow } from '../../../shared/ai-assistant/customer-import/validate.js'
import { buildAnalyzeResultForMatrix } from '../../../shared/ai-assistant/customer-import/fileAnalyze.js'
import { suggestAliasColumnMapping } from '../../../shared/ai-assistant/customer-import/fieldDictionary.js'
import { cellToImportString } from '../../../shared/ai-assistant/customer-import/normalize.js'

/**
 * @typedef {object} ImportPipelineRow
 * @property {string} rowId
 * @property {number} sourceRowNumber
 * @property {string[]} sourceSample
 * @property {Record<string, string>} mapped
 * @property {string} status
 * @property {string[]} reasons
 * @property {object|null} duplicate
 * @property {boolean} eligibleForCommit
 */

/**
 * @param {import('./sessionTypes.js').CustomerImportSession} session
 * @param {object} crmIndex
 * @param {{ duplicatePolicy?: string }} [options]
 */
export function runImportPipeline(session, crmIndex, options = {}) {
  const sheet = session.sheets.find((s) => s.name === session.selectedSheetName)
  if (!sheet) {
    throw Object.assign(new Error('SHEET_NOT_SELECTED'), { code: 'SHEET_NOT_SELECTED' })
  }
  const headerRowIndex = session.headerRowIndex ?? 0
  const analyze = buildAnalyzeResultForMatrix(sheet.matrix, headerRowIndex)
  const headers = analyze.headers
  const columnMapping =
    session.columnMapping && Object.keys(session.columnMapping).length > 0
      ? session.columnMapping
      : suggestAliasColumnMapping(headers)

  const dataStart = headerRowIndex + 1
  const matrix = sheet.matrix
  /** @type {ImportPipelineRow[]} */
  const rows = []
  for (let i = dataStart; i < matrix.length; i += 1) {
    const rawRow = matrix[i]
    if (!Array.isArray(rawRow) || rawRow.every((c) => cellToImportString(c) === '')) {
      continue
    }
    const mapped = mapRawRowToCustomerFields(rawRow, headers, columnMapping)
    const validated = validateMappedCustomerRow(mapped)
    rows.push({
      rowId: `src-${i + 1}`,
      sourceRowNumber: i + 1,
      sourceSample: headers.map((_, colIndex) => cellToImportString(rawRow[colIndex])).slice(0, 6),
      mapped: validated.mapped,
      status: validated.status,
      reasons: [...validated.reasons],
      duplicate: null,
      eligibleForCommit: false,
    })
  }

  const inFileDup = findInFileDuplicateFlags(rows)
  for (const row of rows) {
    const dup = inFileDup.get(row.rowId)
    if (dup) {
      row.reasons.push(dup)
      if (row.status === CUSTOMER_IMPORT_ROW_STATUS.VALID) {
        row.status = CUSTOMER_IMPORT_ROW_STATUS.WARNING
      }
    }
    const crmDup = classifyCrmDuplicate(row.mapped, crmIndex)
    if (crmDup) {
      row.duplicate = crmDup
      row.reasons.push(crmDup.reason)
      if (crmDup.kind === 'STRONG') {
        row.status = CUSTOMER_IMPORT_ROW_STATUS.WARNING
      }
    }
  }

  const duplicatePolicy = options.duplicatePolicy ?? CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP
  for (const row of rows) {
    const invalid = row.status === CUSTOMER_IMPORT_ROW_STATUS.INVALID
    const inFile = row.reasons.includes('DUPLICATE_IN_FILE')
    const existing =
      row.duplicate?.reason === 'DUPLICATE_EXISTING_CUSTOMER' &&
      duplicatePolicy === CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP
    row.eligibleForCommit = !invalid && !inFile && !existing
  }

  const summary = buildImportPreviewSummary(rows)
  const previewVersionHash = computePreviewVersionHash(rows, columnMapping, headerRowIndex)
  return {
    headers,
    columnMapping,
    headerRowIndex,
    rows,
    summary,
    previewVersionHash,
  }
}
