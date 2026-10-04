import { CUSTOMER_IMPORT_ROW_STATUS } from '../../../../shared/ai-assistant/customer-import/constants.js'
import { reasonRequiresImportReview } from '../../../../shared/ai-assistant/customer-import/importReviewGate.js'
import { violatesAutoEligibleFieldQuality } from '../../../../shared/ai-assistant/customer-import/fieldQuality.js'
import { validateMappedCustomerRow } from '../../../../shared/ai-assistant/customer-import/validate.js'
import { cellToImportStringPreserveLines } from '../../../../shared/ai-assistant/customer-import/normalize.js'
import { parseUnstructuredBlockToSemantic } from '../../../../shared/ai-assistant/customer-import/unstructured/semanticFieldExtract.js'
import { isSemanticGptEligible } from '../../../../shared/ai-assistant/customer-import/unstructured/semanticFieldLocks.js'
import { runBoundedConcurrency } from '../../../../shared/ai-assistant/customer-import/runBoundedConcurrency.js'
import { scoreSemanticGptPriority } from '../../../../shared/ai-assistant/customer-import/unstructured/semanticGptPriority.js'
import { buildImportRecordsFromSemantic } from './recordsFromSemantic.js'
import { enrichSemanticBatchWithGpt } from './semanticGptBatchService.js'

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

function createEmptyGptStats() {
  return {
    semanticGptEligible: 0,
    semanticGptPlanned: 0,
    semanticGptAttempts: 0,
    semanticGptSucceeded: 0,
    semanticGptFailed: 0,
    semanticGptCalls: 0,
    semanticGptResolved: 0,
    semanticGptLowConfidence: 0,
    semanticGptSchemaRejected: 0,
    semanticGptTimeout: 0,
    semanticGptSkippedByLimit: 0,
    semanticGptBatchesPlanned: 0,
    semanticGptBatchAttempts: 0,
    semanticGptBatchSucceeded: 0,
    semanticGptBatchFailed: 0,
    semanticGptRecordsPlanned: 0,
    semanticGptRecordsAttempted: 0,
    semanticGptRecordsSucceeded: 0,
    unresolvedAfterGpt: 0,
  }
}

function emitExtractProgress(onProgress, stats, extra = {}) {
  if (!onProgress) {
    return
  }
  onProgress({
    totalBlocks: stats.blocksTotal,
    blocksProcessed: stats.blocksTotal,
    semanticGptEligible: stats.semanticGptEligible,
    semanticGptPlanned: stats.semanticGptPlanned,
    semanticGptAttempts: stats.semanticGptAttempts,
    semanticGptSucceeded: stats.semanticGptSucceeded,
    semanticGptFailed: stats.semanticGptFailed,
    semanticGptResolved: stats.semanticGptResolved,
    semanticGptLowConfidence: stats.semanticGptLowConfidence,
    semanticGptSkippedByLimit: stats.semanticGptSkippedByLimit,
    semanticGptTimeout: stats.semanticGptTimeout,
    ...extra,
  })
}

function isSkippedNonCustomerCell(text) {
  return /^(경정청구|보험|메모|계좌)/.test(text) && !/01[016789]/.test(text) && !/이름|성명|고객명/.test(text)
}

/**
 * @param {import('../sessionTypes.js').CustomerImportSession} session
 * @param {import('node:process')} [env]
 * @param {{ onProgress?: (progress: object) => void }} [options]
 */
export async function runUnstructuredCellExtract(session, env = process.env, options = {}) {
  const onProgress = options.onProgress
  const gptConcurrency =
    Number(env.SEMANTIC_GPT_CONCURRENCY) > 0 ? Number(env.SEMANTIC_GPT_CONCURRENCY) : 3
  const gptBatchSize = Number(env.SEMANTIC_GPT_BATCH_SIZE) > 0 ? Number(env.SEMANTIC_GPT_BATCH_SIZE) : 6
  const sheetName = session.selectedSheetName ?? session.sheets[0]?.name
  const sheet = session.sheets.find((s) => s.name === sheetName)
  if (!sheet) {
    throw Object.assign(new Error('SHEET_NOT_FOUND'), { code: 'SHEET_NOT_FOUND', status: 404 })
  }

  const maxGptCallBudget = Number(env.SEMANTIC_GPT_MAX_CALLS_PER_SESSION) > 0
    ? Number(env.SEMANTIC_GPT_MAX_CALLS_PER_SESSION)
    : 48
  const maxGptRecords = maxGptCallBudget * gptBatchSize

  const matrix = sheet.matrix
  const stats = {
    nonEmptyCells: 0,
    customerCandidates: 0,
    multiPersonCells: 0,
    nonCustomerCells: 0,
    reviewRequired: 0,
    blocksTotal: 0,
    deterministicOnlyResolved: 0,
    ...createEmptyGptStats(),
  }

  /** @type {Array<{ blockKey: string, text: string, sourceCell: string, semantic: import('../../../../shared/ai-assistant/customer-import/unstructured/semanticFieldExtract.js').UnstructuredSemanticRecord, gptEligible: boolean }>} */
  const blocks = []

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
      if (isSkippedNonCustomerCell(text)) {
        stats.nonCustomerCells += 1
        continue
      }
      stats.blocksTotal += 1
      const cellRef = `${columnIndexToLetters(c)}${r + 1}`
      const sourceCell = `${sheet.name}!${cellRef}`
      const blockKey = `${r}:${c}`
      const semantic = parseUnstructuredBlockToSemantic(text)
      const gptEligible = isSemanticGptEligible(semantic)
      if (!gptEligible) {
        stats.deterministicOnlyResolved += 1
      } else {
        stats.semanticGptEligible += 1
      }
      blocks.push({ blockKey, text, sourceCell, semantic, gptEligible })
    }
  }

  const gptOrder = blocks
    .filter((b) => b.gptEligible)
    .map((b, index) => ({ ...b, scanOrder: index, priority: scoreSemanticGptPriority(b.semantic, b.text) }))
    .sort((a, b) => b.priority - a.priority || a.scanOrder - b.scanOrder)

  /** @type {Map<string, { semantic: import('../../../../shared/ai-assistant/customer-import/unstructured/semanticFieldExtract.js').UnstructuredSemanticRecord, gptWarnings: string[], blockGptUsed: boolean }>} */
  const gptByBlockKey = new Map()
  let openAiCalls = 0
  let gptUsed = false

  const gptPlannedItems = gptOrder.slice(0, maxGptCalls)
  const gptSkippedItems = gptOrder.slice(maxGptCalls)
  stats.semanticGptPlanned = gptPlannedItems.length
  stats.semanticGptSkippedByLimit = gptSkippedItems.length

  for (const item of gptSkippedItems) {
    item.semantic.needsSemanticReview = true
    gptByBlockKey.set(item.blockKey, {
      semantic: item.semantic,
      gptWarnings: ['SEMANTIC_GPT_CALL_CAP', 'REVIEW_REQUIRED'],
      blockGptUsed: false,
    })
  }

  stats.semanticGptRecordsPlanned = gptPlannedItems.length
  const gptBatches = []
  for (let i = 0; i < gptPlannedItems.length; i += gptBatchSize) {
    gptBatches.push(gptPlannedItems.slice(i, i + gptBatchSize))
  }
  stats.semanticGptBatchesPlanned = gptBatches.length

  emitExtractProgress(onProgress, stats)

  await runBoundedConcurrency(gptBatches, gptConcurrency, async (batch) => {
    stats.semanticGptBatchAttempts += 1
    stats.semanticGptAttempts += 1
    const batchPayload = batch.map((item) => ({
      recordId: item.blockKey,
      semantic: item.semantic,
      text: item.text,
    }))
    const gpt = await enrichSemanticBatchWithGpt(batchPayload, env)
    if (gpt.attempted && gpt.succeeded) {
      stats.semanticGptBatchSucceeded += 1
      stats.semanticGptCalls += 1
      openAiCalls += 1
      gptUsed = true
    } else if (gpt.attempted) {
      stats.semanticGptBatchFailed += 1
      stats.semanticGptFailed += 1
      if (gpt.timeout) {
        stats.semanticGptTimeout += 1
      }
    }
    stats.semanticGptRecordsAttempted += batch.length
    stats.semanticGptRecordsSucceeded += gpt.recordStats?.succeeded ?? 0
    stats.semanticGptSucceeded += gpt.recordStats?.succeeded ?? 0
    stats.semanticGptResolved += gpt.recordStats?.resolvedTotal ?? 0
    stats.semanticGptLowConfidence += gpt.recordStats?.lowConfidence ?? 0

    for (const item of batch) {
      const merged = gpt.results?.get(item.blockKey)
      const gptWarnings = [...(merged?.warnings ?? gpt.batchWarnings ?? [])]
      let semantic = merged?.semantic ?? item.semantic
      const blockGptUsed = Boolean(merged?.succeeded)
      if (!blockGptUsed) {
        semantic.needsSemanticReview = true
        if (!gptWarnings.includes('REVIEW_REQUIRED')) {
          gptWarnings.push('REVIEW_REQUIRED')
        }
      }
      gptByBlockKey.set(item.blockKey, { semantic, gptWarnings, blockGptUsed })
    }
    emitExtractProgress(onProgress, stats)
    return null
  })

  /** @type {Array<object>} */
  const rawRecords = []
  let recordSeq = 0

  for (const block of blocks) {
    const cached = gptByBlockKey.get(block.blockKey)
    const semantic = cached?.semantic ?? block.semantic
    const gptWarnings = cached?.gptWarnings ?? []
    const blockGptUsed = Boolean(cached?.blockGptUsed)

    if (block.gptEligible) {
      stats.unresolvedAfterGpt += semantic.unresolvedLines.length
    }

    const built = buildImportRecordsFromSemantic(semantic, { sourceCell: block.sourceCell, sourceText: block.text })
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
        sourceText: rec.sourceText ?? block.text,
      })
      recordSeq += 1
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
    if (rec.classification === 'REVIEW_REQUIRED' && !reasons.includes('REVIEW_REQUIRED')) {
      status = CUSTOMER_IMPORT_ROW_STATUS.WARNING
      reasons.push('REVIEW_REQUIRED')
    }
    if (reasonRequiresImportReview(reasons)) {
      if (!reasons.includes('REVIEW_REQUIRED')) {
        reasons.push('REVIEW_REQUIRED')
      }
      if (status === CUSTOMER_IMPORT_ROW_STATUS.VALID) {
        status = CUSTOMER_IMPORT_ROW_STATUS.WARNING
      }
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
