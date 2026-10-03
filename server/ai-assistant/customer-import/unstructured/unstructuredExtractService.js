import { CUSTOMER_IMPORT_ROW_STATUS } from '../../../../shared/ai-assistant/customer-import/constants.js'
import { violatesAutoEligibleFieldQuality } from '../../../../shared/ai-assistant/customer-import/fieldQuality.js'
import { validateMappedCustomerRow } from '../../../../shared/ai-assistant/customer-import/validate.js'
import { cellToImportStringPreserveLines } from '../../../../shared/ai-assistant/customer-import/normalize.js'
import { parseUnstructuredBlockToSemantic } from '../../../../shared/ai-assistant/customer-import/unstructured/semanticFieldExtract.js'
import { isSemanticGptEligible } from '../../../../shared/ai-assistant/customer-import/unstructured/semanticFieldLocks.js'
import { buildImportRecordsFromSemantic } from './recordsFromSemantic.js'
import { enrichSemanticWithGpt } from './semanticGptService.js'

function columnIndexToLetters(index) {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/**
 * @param {import('../sessionTypes.js').CustomerImportSession} session
 * @param {import('node:process')} [env]
 */
export async function runUnstructuredCellExtract(session, env = process.env) {
  const sheetName = session.selectedSheetName ?? session.sheets[0]?.name
  const sheet = session.sheets.find((s) => s.name === sheetName)
  if (!sheet) {
    throw Object.assign(new Error('SHEET_NOT_FOUND'), { code: 'SHEET_NOT_FOUND', status: 404 })
  }

  const maxGptCalls = Number(env.SEMANTIC_GPT_MAX_CALLS_PER_SESSION) > 0
    ? Number(env.SEMANTIC_GPT_MAX_CALLS_PER_SESSION)
    : 48

  const matrix = sheet.matrix
  const stats = {
    nonEmptyCells: 0,
    customerCandidates: 0,
    multiPersonCells: 0,
    nonCustomerCells: 0,
    reviewRequired: 0,
    blocksTotal: 0,
    deterministicOnlyResolved: 0,
    semanticGptEligible: 0,
    semanticGptCalls: 0,
    semanticGptResolved: 0,
    unresolvedAfterGpt: 0,
  }
  /** @type {Array<object>} */
  const rawRecords = []
  let recordSeq = 0
  let openAiCalls = 0
  let gptUsed = false

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
      const cellRef = `${columnIndexToLetters(c)}${r + 1}`
      const sourceCell = `${sheet.name}!${cellRef}`

      if (/^(경정청구|보험|메모|계좌)/.test(text) && !/01[016789]/.test(text) && !/이름|성명|고객명/.test(text)) {
        stats.nonCustomerCells += 1
        continue
      }

      stats.blocksTotal += 1
      let semantic = parseUnstructuredBlockToSemantic(text)
      let gptWarnings = []
      let blockGptUsed = false

      if (!isSemanticGptEligible(semantic)) {
        stats.deterministicOnlyResolved += 1
      } else {
        stats.semanticGptEligible += 1
        if (openAiCalls < maxGptCalls) {
          const gpt = await enrichSemanticWithGpt(semantic, text, env)
          gptWarnings = gpt.warnings ?? []
          if (gpt.called) {
            gptUsed = true
            blockGptUsed = true
            openAiCalls += 1
            stats.semanticGptCalls += 1
            stats.semanticGptResolved += gpt.resolvedCount ?? 0
            semantic = gpt.semantic
          }
        } else {
          gptWarnings = ['SEMANTIC_GPT_CALL_CAP']
          semantic.needsSemanticReview = true
        }
        stats.unresolvedAfterGpt += semantic.unresolvedLines.length
      }

      const built = buildImportRecordsFromSemantic(semantic, { sourceCell, sourceText: text })
      if (built.kind === 'MULTI_PERSON') {
        stats.multiPersonCells += 1
      }
      if (built.records.length === 0 && built.kind === 'REVIEW_REQUIRED') {
        stats.reviewRequired += 1
        continue
      }

      for (const rec of built.records) {
        const warnings = [...(rec.warnings ?? []), ...gptWarnings]
        if (rec.classification === 'REVIEW_REQUIRED') {
          stats.reviewRequired += 1
        } else {
          stats.customerCandidates += 1
        }
        rawRecords.push({
          ...rec,
          warnings,
          blockGptUsed,
          sourceBlockIndex: recordSeq,
          rowId: `unstruct-${recordSeq}`,
          sourceText: rec.sourceText ?? text,
        })
        recordSeq += 1
      }
    }
  }

  const pipelineRows = rawRecords.map((rec, index) => {
    const mapped = {
      name: rec.name ?? '',
      phone: rec.phone ?? '',
      address: rec.address ?? '',
      ssn: rec.ssn ?? '',
      height: rec.height ?? '',
      weight: rec.weight ?? '',
      job: rec.job ?? '',
      carNumber: rec.carNumber ?? '',
      carModel: rec.carModel ?? '',
      carYear: rec.carYear ?? '',
      carType: rec.carType ?? '',
      medical: rec.medical ?? '',
      insuranceHistory: rec.insuranceHistory ?? '',
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
        semanticFields: rec.semanticFields ?? null,
        semanticGptEligible: isSemanticGptEligible(parseUnstructuredBlockToSemantic(sourceText)),
        semanticGptUsed: Boolean(rec.blockGptUsed),
      },
    }
  })

  return {
    stats,
    pipelineRows,
    gptUsed,
    openAiCalls,
  }
}
