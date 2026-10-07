import { CUSTOMER_IMPORT_DUPLICATE_POLICY, CUSTOMER_IMPORT_ROW_STATUS } from './constants.js'
import { CUSTOMER_IMPORT_REASON } from './constants.js'

export const PREVIEW_ROW_FINAL_STATUS = Object.freeze({
  AUTO_ELIGIBLE: 'AUTO_ELIGIBLE',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  DUPLICATE_SKIPPED: 'DUPLICATE_SKIPPED',
  INVALID: 'INVALID',
})

/**
 * @param {{ status: string, reasons?: string[], eligibleForCommit?: boolean, duplicate?: { reason?: string } }} row
 * @param {{ duplicatePolicy?: string }} [options]
 */
export function classifyPreviewRowFinalStatus(row, options = {}) {
  const duplicatePolicy = options.duplicatePolicy ?? CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP
  if (row.status === CUSTOMER_IMPORT_ROW_STATUS.INVALID) {
    return PREVIEW_ROW_FINAL_STATUS.INVALID
  }
  if (row.reasons?.includes(CUSTOMER_IMPORT_REASON.DUPLICATE_IN_FILE)) {
    return PREVIEW_ROW_FINAL_STATUS.DUPLICATE_SKIPPED
  }
  if (
    row.duplicate?.reason === CUSTOMER_IMPORT_REASON.DUPLICATE_EXISTING_CUSTOMER &&
    duplicatePolicy === CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP
  ) {
    return PREVIEW_ROW_FINAL_STATUS.DUPLICATE_SKIPPED
  }
  if (row.eligibleForCommit) {
    return PREVIEW_ROW_FINAL_STATUS.AUTO_ELIGIBLE
  }
  return PREVIEW_ROW_FINAL_STATUS.REVIEW_REQUIRED
}

/**
 * Mutually exclusive preview buckets (one per row).
 * @param {Array<object>} rows
 * @param {{ duplicatePolicy?: string }} [options]
 */
export function buildImportPreviewSummarySsot(rows, options = {}) {
  const list = Array.isArray(rows) ? rows : []
  const ssot = {
    totalCandidates: list.length,
    autoEligible: 0,
    reviewRequired: 0,
    duplicateSkipped: 0,
    invalid: 0,
    plannedCreate: 0,
    plannedSkip: 0,
  }
  for (const row of list) {
    const bucket = classifyPreviewRowFinalStatus(row, options)
    if (bucket === PREVIEW_ROW_FINAL_STATUS.AUTO_ELIGIBLE) {
      ssot.autoEligible += 1
    } else if (bucket === PREVIEW_ROW_FINAL_STATUS.DUPLICATE_SKIPPED) {
      ssot.duplicateSkipped += 1
    } else if (bucket === PREVIEW_ROW_FINAL_STATUS.INVALID) {
      ssot.invalid += 1
    } else {
      ssot.reviewRequired += 1
    }
  }
  ssot.plannedCreate = ssot.autoEligible
  ssot.plannedSkip = ssot.totalCandidates - ssot.plannedCreate
  return ssot
}
