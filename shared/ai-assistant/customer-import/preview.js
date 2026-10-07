import { createHash } from 'node:crypto'

import { CUSTOMER_IMPORT_ROW_STATUS } from './constants.js'
import { buildImportPreviewSummarySsot } from './previewSummarySsot.js'

/**
 * @param {Array<{ rowId: string, status: string, reasons: string[], mapped: Record<string, string>, duplicate?: object }>} rows
 */
/**
 * @param {Array<object>} rows
 * @param {{ duplicatePolicy?: string }} [options]
 */
export function buildImportPreviewSummary(rows, options = {}) {
  const ssot = buildImportPreviewSummarySsot(rows, options)
  const summary = {
    totalSourceRows: rows.length,
    totalCandidates: ssot.totalCandidates,
    autoEligible: ssot.autoEligible,
    reviewRequired: ssot.reviewRequired,
    duplicateSkipped: ssot.duplicateSkipped,
    invalid: ssot.invalid,
    valid: 0,
    warning: 0,
    duplicateInFile: 0,
    duplicateExisting: 0,
    duplicatePossible: 0,
    plannedCreate: ssot.plannedCreate,
    plannedSkip: ssot.plannedSkip,
  }
  for (const row of rows) {
    if (row.status === CUSTOMER_IMPORT_ROW_STATUS.VALID) {
      summary.valid += 1
    } else if (row.status === CUSTOMER_IMPORT_ROW_STATUS.WARNING) {
      summary.warning += 1
    } else {
      summary.invalid += 1
    }
    if (row.reasons?.includes('DUPLICATE_IN_FILE')) {
      summary.duplicateInFile += 1
    }
    if (row.duplicate?.reason === 'DUPLICATE_EXISTING_CUSTOMER') {
      summary.duplicateExisting += 1
    }
    if (row.duplicate?.reason === 'DUPLICATE_POSSIBLE_NAME') {
      summary.duplicatePossible += 1
    }
  }
  return summary
}

export function computePreviewVersionHash(rows, mapping, headerRowIndex) {
  const payload = JSON.stringify({
    headerRowIndex,
    mapping,
    rows: rows.map((r) => ({
      rowId: r.rowId,
      status: r.status,
      reasons: r.reasons,
      phone: r.mapped?.phone,
      name: r.mapped?.name,
      eligible: r.eligibleForCommit,
    })),
  })
  return createHash('sha256').update(payload).digest('hex')
}
