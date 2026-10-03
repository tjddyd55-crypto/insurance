import { CUSTOMER_IMPORT_ROW_STATUS } from '../../../../shared/ai-assistant/customer-import/constants.js'
import { violatesAutoEligibleFieldQuality } from '../../../../shared/ai-assistant/customer-import/fieldQuality.js'
import { validateMappedCustomerRow } from '../../../../shared/ai-assistant/customer-import/validate.js'
import { cellToImportStringPreserveLines } from '../../../../shared/ai-assistant/customer-import/normalize.js'
import { parseUnstructuredCellDeterministic } from './deterministicCellParse.js'

/**
 * @param {import('../sessionTypes.js').CustomerImportSession} session
 */
export function runUnstructuredCellExtract(session) {
  const sheetName = session.selectedSheetName ?? session.sheets[0]?.name
  const sheet = session.sheets.find((s) => s.name === sheetName)
  if (!sheet) {
    throw Object.assign(new Error('SHEET_NOT_FOUND'), { code: 'SHEET_NOT_FOUND', status: 404 })
  }

  const matrix = sheet.matrix
  const stats = {
    nonEmptyCells: 0,
    customerCandidates: 0,
    multiPersonCells: 0,
    nonCustomerCells: 0,
    reviewRequired: 0,
  }
  /** @type {Array<object>} */
  const rawRecords = []
  let recordSeq = 0

  for (let r = 0; r < matrix.length; r += 1) {
    const row = matrix[r]
    if (!Array.isArray(row)) {
      continue
    }
    for (let c = 0; c < row.length; c += 1) {
      const text = cellToImportStringPreserveLines(row[c])
      if (!text) {
        continue
      }
      stats.nonEmptyCells += 1
      const parsed = parseUnstructuredCellDeterministic(sheet.name, r, c, row[c])
      if (parsed.kind === 'NON_CUSTOMER' || parsed.kind === 'EMPTY') {
        stats.nonCustomerCells += 1
        continue
      }
      if (parsed.kind === 'MULTI_PERSON') {
        stats.multiPersonCells += 1
      }
      for (const rec of parsed.records) {
        if (rec.classification === 'REVIEW_REQUIRED') {
          stats.reviewRequired += 1
        } else {
          stats.customerCandidates += 1
        }
        rawRecords.push({
          ...rec,
          sourceBlockIndex: recordSeq,
          rowId: `unstruct-${recordSeq}`,
          sourceText: rec.sourceText ?? text,
        })
        recordSeq += 1
      }
      if (parsed.records.length === 0 && parsed.kind === 'REVIEW_REQUIRED') {
        stats.reviewRequired += 1
      }
    }
  }

  const pipelineRows = rawRecords.map((rec, index) => {
    const mapped = {
      name: rec.name ?? '',
      phone: rec.phone ?? '',
      address: rec.address ?? '',
      job: rec.job ?? '',
      memo: rec.memo ?? '',
    }
    const sourceText = rec.sourceText ?? ''
    const validated = validateMappedCustomerRow(mapped, { unstructuredSourceText: sourceText })
    let status = validated.status
    const reasons = [...validated.reasons, ...(rec.warnings ?? [])]
    if (rec.classification === 'REVIEW_REQUIRED' && status === CUSTOMER_IMPORT_ROW_STATUS.VALID) {
      status = CUSTOMER_IMPORT_ROW_STATUS.WARNING
      reasons.push('REVIEW_REQUIRED')
    }
    const fieldIssues = violatesAutoEligibleFieldQuality(validated.mapped, { unstructuredSourceText: sourceText })
    if (fieldIssues.length > 0) {
      status = CUSTOMER_IMPORT_ROW_STATUS.WARNING
      if (!reasons.includes('REVIEW_REQUIRED')) {
        reasons.push('REVIEW_REQUIRED')
      }
    }
    return {
      rowId: rec.rowId ?? `unstruct-${index + 1}`,
      sourceRowNumber: index + 1,
      sourceSample: [rec.sourceCell, rec.name ?? '', rec.phone ?? ''].filter(Boolean),
      mapped: validated.mapped,
      status,
      reasons,
      duplicate: null,
      eligibleForCommit: false,
      unstructuredMeta: {
        sourceSheetName: sheet.name,
        sourceCell: rec.sourceCell,
        sourceRecordIndex: rec.sourceRecordIndex,
        confidence: rec.confidence,
        classification: rec.classification,
        sourceCellText: sourceText.slice(0, 2000),
        fieldQualityIssues: fieldIssues,
      },
    }
  })

  return {
    stats,
    pipelineRows,
    gptUsed: false,
    openAiCalls: 0,
  }
}
