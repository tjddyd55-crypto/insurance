/**
 * CustomerCandidate — canonical pre-commit representation for AI customer ingestion.
 *
 * Runtime SSOT: `ImportPipelineRow` in `pipeline.js` (session.rows / preview rows).
 * Field keys in `mapped` follow `CUSTOMER_IMPORT_FIELD_KEYS` (fieldDictionary.js).
 * DB write shape: `mapRowToCustomerBody()` → `insertCustomerForImport()`.
 *
 * Do not add parallel candidate models; extend ImportPipelineRow + mapped fields only.
 */

import { CUSTOMER_IMPORT_ROW_STATUS } from '../../../shared/ai-assistant/customer-import/constants.js'

/**
 * @typedef {import('./pipeline.js').ImportPipelineRow} CustomerCandidate
 */

/**
 * @param {import('./pipeline.js').ImportPipelineRow} row
 */
export function toCustomerCandidateView(row) {
  const meta = row.unstructuredMeta ?? {}
  return {
    mapped: row.mapped ?? {},
    status: row.status,
    reasons: row.reasons ?? [],
    eligibleForCommit: Boolean(row.eligibleForCommit),
    duplicate: row.duplicate ?? null,
    sourceLocation: meta.sourceCell ?? row.sourceSample?.[0] ?? null,
    sourceSheetName: meta.sourceSheetName ?? null,
    classification: meta.classification ?? null,
    confidence: meta.confidence ?? null,
    rowId: row.rowId,
    sourceRowNumber: row.sourceRowNumber,
  }
}

/**
 * @param {import('./pipeline.js').ImportPipelineRow} row
 */
export function canAutoCommitCandidate(row) {
  if (!row?.eligibleForCommit) {
    return false
  }
  if (row.status === CUSTOMER_IMPORT_ROW_STATUS.INVALID) {
    return false
  }
  if ((row.reasons ?? []).includes('REVIEW_REQUIRED')) {
    return false
  }
  return true
}
