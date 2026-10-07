import { CUSTOMER_IMPORT_DUPLICATE_POLICY } from '../../../shared/ai-assistant/customer-import/constants.js'
import { assertCustomerImportFileMeta, buildAnalyzeResultForMatrix, matrixSheetStats } from '../../../shared/ai-assistant/customer-import/fileAnalyze.js'
import {
  CUSTOMER_IMPORT_SOURCE_MODE,
  detectWorkbookImportSourceMode,
  summarizeUnstructuredWorkbook,
} from '../../../shared/ai-assistant/customer-import/importSourceMode.js'
import { runUnstructuredCellExtract } from './unstructured/unstructuredExtractService.js'
import { suggestAliasColumnMapping } from '../../../shared/ai-assistant/customer-import/fieldDictionary.js'
import { normalizeUploadedFileName } from '../../../shared/ai-assistant/customer-import/filenameEncoding.js'
import { buildImportPreviewSummary } from '../../../shared/ai-assistant/customer-import/preview.js'
import { readWorkbookFromBuffer } from './workbookReader.js'
import { createCustomerImportSession, getCustomerImportSession, updateCustomerImportSession } from './sessionStore.js'
import { runImportPipeline } from './pipeline.js'
import { loadCrmDuplicateIndex } from './crmDuplicateIndex.js'
import { commitCustomerImportSession } from './commitService.js'
import { logCustomerImportToolAudit } from './auditLog.js'
import { runCustomerImportColumnMap } from '../column-map/columnMapService.js'

export const CUSTOMER_IMPORT_TOOL_KEYS = {
  FILE_ANALYZE: 'customer.import.file-analyze',
  SHEET_SELECT: 'customer.import.sheet-select',
  COLUMN_MAP: 'customer.import.column-map',
  NORMALIZE: 'customer.import.normalize',
  DUPLICATE_CHECK: 'customer.import.duplicate-check',
  VALIDATION: 'customer.import.validation',
  PREVIEW: 'customer.import.preview',
  COMMIT: 'customer.import.commit',
  FAILURE_REPORT: 'customer.import.failure-report',
  UNSTRUCTURED_EXTRACT: 'customer.import.unstructured-extract',
}

/**
 * @param {import('pg').Pool} pool
 * @param {import('express').Request} req
 * @param {string} toolKey
 * @param {object} input
 */
export async function executeCustomerImportTool(pool, req, toolKey, input = {}) {
  const started = Date.now()
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = Number(req.user?.gaId)
  try {
    let result
    switch (toolKey) {
      case CUSTOMER_IMPORT_TOOL_KEYS.FILE_ANALYZE:
        result = await toolFileAnalyze(req, input)
        break
      case CUSTOMER_IMPORT_TOOL_KEYS.SHEET_SELECT:
        result = await toolSheetSelect(req, input)
        break
      case CUSTOMER_IMPORT_TOOL_KEYS.COLUMN_MAP:
        result = await toolColumnMap(req, input)
        break
      case CUSTOMER_IMPORT_TOOL_KEYS.NORMALIZE:
        result = await toolPipelineStep(pool, req, input, 'normalize')
        break
      case CUSTOMER_IMPORT_TOOL_KEYS.VALIDATION:
        result = await toolPipelineStep(pool, req, input, 'validation')
        break
      case CUSTOMER_IMPORT_TOOL_KEYS.DUPLICATE_CHECK:
        result = await toolPipelineStep(pool, req, input, 'duplicate')
        break
      case CUSTOMER_IMPORT_TOOL_KEYS.PREVIEW:
        result = await toolPipelineStep(pool, req, input, 'preview')
        break
      case CUSTOMER_IMPORT_TOOL_KEYS.COMMIT:
        result = await toolCommit(pool, req, input)
        break
      case CUSTOMER_IMPORT_TOOL_KEYS.FAILURE_REPORT:
        result = await toolFailureReport(req, input)
        break
      case CUSTOMER_IMPORT_TOOL_KEYS.UNSTRUCTURED_EXTRACT:
        result = await toolUnstructuredExtract(req, input)
        break
      default:
        throw Object.assign(new Error('UNKNOWN_TOOL'), { code: 'UNKNOWN_TOOL', status: 400 })
    }
    logCustomerImportToolAudit({
      toolKey,
      userId,
      gaId,
      importSessionId: input.importSessionId ?? result?.importSessionId ?? null,
      rowCounts: result?.summary ?? null,
      status: 'ok',
      durationMs: Date.now() - started,
    })
    return result
  } catch (error) {
    logCustomerImportToolAudit({
      toolKey,
      userId,
      gaId,
      importSessionId: input.importSessionId ?? null,
      status: 'error',
      errorCode: error?.code ?? error?.message,
      durationMs: Date.now() - started,
    })
    throw error
  }
}

async function toolFileAnalyze(req, input) {
  const buffer = input.fileBuffer
  const originalFileName = normalizeUploadedFileName(input.originalFileName)
  const mimeType = input.mimeType
  const fileType = assertCustomerImportFileMeta({
    originalFileName,
    byteLength: buffer?.length,
    mimeType,
  })
  const { sheets } = readWorkbookFromBuffer(buffer, fileType)
  if (!sheets.length) {
    throw Object.assign(new Error('EMPTY_WORKBOOK'), { code: 'EMPTY_WORKBOOK' })
  }
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = Number(req.user?.gaId)
  const sheetSummaries = sheets.map((s) => ({
    name: s.name,
    ...matrixSheetStats(s.matrix),
  }))
  const defaultSheet = sheets.find((s) => s.name === '고객정보') ?? sheets[0]
  const importSourceMode = detectWorkbookImportSourceMode(sheets)
  const analyze =
    importSourceMode === CUSTOMER_IMPORT_SOURCE_MODE.UNSTRUCTURED_CELL_RECORDS
      ? {
          headerRowIndex: 0,
          headers: [],
          headerCandidates: [],
          sampleRows: [],
          stats: matrixSheetStats(defaultSheet.matrix),
        }
      : buildAnalyzeResultForMatrix(defaultSheet.matrix, null)
  const session = createCustomerImportSession({
    userId,
    gaId,
    originalFileName,
    fileType,
    fileBuffer: buffer,
    sheets,
    selectedSheetName: defaultSheet.name,
    headerRowIndex: analyze.headerRowIndex,
    headers: analyze.headers,
    sampleRows: analyze.sampleRows,
    headerCandidates: analyze.headerCandidates,
    columnMapping: suggestAliasColumnMapping(analyze.headers),
    rows: [],
    previewVersionHash: null,
    commitStatus: 'idle',
    commitResult: null,
    lastCommitIdempotencyKey: null,
    importSourceMode,
    unstructuredWorkbookSummary:
      importSourceMode === CUSTOMER_IMPORT_SOURCE_MODE.UNSTRUCTURED_CELL_RECORDS
        ? summarizeUnstructuredWorkbook(sheets, defaultSheet.name)
        : null,
    unstructuredExtractDone: false,
    unstructuredExtractStats: null,
  })
  return {
    toolKey: CUSTOMER_IMPORT_TOOL_KEYS.FILE_ANALYZE,
    importSessionId: session.importSessionId,
    importSourceMode,
    unstructuredWorkbookSummary: session.unstructuredWorkbookSummary,
    originalFileName,
    fileType,
    sheets: sheetSummaries,
    suggestedSheetName: defaultSheet.name,
    headerRowIndex: analyze.headerRowIndex,
    headerCandidates: analyze.headerCandidates,
    headers: analyze.headers,
    sampleRows: analyze.sampleRows,
    stats: analyze.stats,
    expiresAt: new Date(session.expiresAt).toISOString(),
  }
}

async function toolUnstructuredExtract(req, input) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = Number(req.user?.gaId)
  const session = getCustomerImportSession(input.importSessionId, userId, gaId)
  if (session.importSourceMode !== CUSTOMER_IMPORT_SOURCE_MODE.UNSTRUCTURED_CELL_RECORDS) {
    throw Object.assign(new Error('NOT_UNSTRUCTURED_WORKBOOK'), { code: 'NOT_UNSTRUCTURED_WORKBOOK', status: 400 })
  }
  const extracted = await runUnstructuredCellExtract(session)
  updateCustomerImportSession(input.importSessionId, userId, gaId, {
    rows: extracted.pipelineRows,
    unstructuredExtractDone: true,
    unstructuredExtractStats: extracted.stats,
    previewVersionHash: null,
    commitStatus: 'idle',
  })
  return {
    toolKey: CUSTOMER_IMPORT_TOOL_KEYS.UNSTRUCTURED_EXTRACT,
    importSessionId: input.importSessionId,
    stats: extracted.stats,
    recordCount: extracted.pipelineRows.length,
    gptUsed: extracted.gptUsed,
    openAiCalls: extracted.openAiCalls,
  }
}

async function toolColumnMap(req, input) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = Number(req.user?.gaId)
  const session = getCustomerImportSession(input.importSessionId, userId, gaId)
  const mapped = await runCustomerImportColumnMap(session, { forceGpt: input.forceGpt === true })
  updateCustomerImportSession(input.importSessionId, userId, gaId, {
    columnMapping: mapped.columnMapping,
    columnMapMeta: {
      gptUsed: mapped.gptUsed,
      mappings: mapped.mappings ?? [],
      warnings: mapped.warnings ?? [],
    },
    previewVersionHash: null,
    commitStatus: 'idle',
    commitResult: null,
  })
  return {
    toolKey: CUSTOMER_IMPORT_TOOL_KEYS.COLUMN_MAP,
    importSessionId: input.importSessionId,
    columnMapping: mapped.columnMapping,
    gptUsed: mapped.gptUsed,
    mappings: mapped.mappings,
    ignoredColumns: mapped.ignoredColumns,
    warnings: mapped.warnings,
  }
}

async function toolSheetSelect(req, input) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = Number(req.user?.gaId)
  const session = getCustomerImportSession(input.importSessionId, userId, gaId)
  const sheetName = String(input.sheetName ?? '').trim()
  const sheet = session.sheets.find((s) => s.name === sheetName)
  if (!sheet) {
    throw Object.assign(new Error('SHEET_NOT_FOUND'), { code: 'SHEET_NOT_FOUND', status: 404 })
  }
  const headerRowIndex =
    input.headerRowIndex != null ? Number(input.headerRowIndex) : session.headerRowIndex ?? 0
  const analyze = buildAnalyzeResultForMatrix(sheet.matrix, headerRowIndex)
  const columnMapping =
    input.columnMapping && Object.keys(input.columnMapping).length > 0
      ? input.columnMapping
      : suggestAliasColumnMapping(analyze.headers)
  updateCustomerImportSession(input.importSessionId, userId, gaId, {
    selectedSheetName: sheetName,
    headerRowIndex: analyze.headerRowIndex,
    headers: analyze.headers,
    columnMapping,
    rows: [],
    previewVersionHash: null,
    commitStatus: 'idle',
    commitResult: null,
  })
  return {
    toolKey: CUSTOMER_IMPORT_TOOL_KEYS.SHEET_SELECT,
    importSessionId: input.importSessionId,
    selectedSheetName: sheetName,
    headerRowIndex: analyze.headerRowIndex,
    headers: analyze.headers,
    columnMapping,
    stats: analyze.stats,
  }
}

async function toolPipelineStep(pool, req, input, step) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = Number(req.user?.gaId)
  const session = getCustomerImportSession(input.importSessionId, userId, gaId)
  const crmIndex = await loadCrmDuplicateIndex(pool, req, userId, gaId)
  const pipeline = await runImportPipeline(session, crmIndex, {
    duplicatePolicy: input.duplicatePolicy ?? CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP,
  })
  const toolKeyMap = {
    normalize: CUSTOMER_IMPORT_TOOL_KEYS.NORMALIZE,
    validation: CUSTOMER_IMPORT_TOOL_KEYS.VALIDATION,
    duplicate: CUSTOMER_IMPORT_TOOL_KEYS.DUPLICATE_CHECK,
    preview: CUSTOMER_IMPORT_TOOL_KEYS.PREVIEW,
  }
  updateCustomerImportSession(input.importSessionId, userId, gaId, {
    rows: pipeline.rows,
    previewVersionHash: pipeline.previewVersionHash,
    commitStatus: 'preview_ready',
    headers: pipeline.headers,
    columnMapping: pipeline.columnMapping,
    headerRowIndex: pipeline.headerRowIndex,
  })
  const base = {
    toolKey: toolKeyMap[step],
    importSessionId: input.importSessionId,
    summary: pipeline.summary,
    previewVersionHash: pipeline.previewVersionHash,
  }
  if (step === 'preview') {
    return {
      ...base,
      rows: pipeline.rows.map((r) => ({
        rowId: r.rowId,
        sourceRowNumber: r.sourceRowNumber,
        sourceSample: r.sourceSample,
        mapped: r.mapped,
        status: r.status,
        reasons: r.reasons,
        duplicate: r.duplicate,
        eligibleForCommit: r.eligibleForCommit,
      })),
    }
  }
  if (step === 'normalize') {
    return { ...base, normalizedRowCount: pipeline.rows.length }
  }
  if (step === 'validation') {
    return {
      ...base,
      valid: pipeline.summary.valid,
      warning: pipeline.summary.warning,
      invalid: pipeline.summary.invalid,
    }
  }
  return {
    ...base,
    duplicateInFile: pipeline.summary.duplicateInFile,
    duplicateExisting: pipeline.summary.duplicateExisting,
  }
}

async function toolCommit(pool, req, input) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = Number(req.user?.gaId)
  const session = getCustomerImportSession(input.importSessionId, userId, gaId)
  if (session.commitStatus === 'committed' && session.commitResult) {
    return { toolKey: CUSTOMER_IMPORT_TOOL_KEYS.COMMIT, ...session.commitResult, idempotentReplay: true }
  }
  if (session.commitStatus !== 'preview_ready' || !session.previewVersionHash) {
    throw Object.assign(new Error('PREVIEW_REQUIRED'), { code: 'PREVIEW_REQUIRED', status: 400 })
  }
  if (input.previewVersionHash && input.previewVersionHash !== session.previewVersionHash) {
    throw Object.assign(new Error('STALE_PREVIEW'), { code: 'STALE_PREVIEW', status: 409 })
  }
  const idempotencyKey = String(input.idempotencyKey ?? input.commitId ?? '').trim()
  if (idempotencyKey && session.lastCommitIdempotencyKey === idempotencyKey && session.commitResult) {
    return { toolKey: CUSTOMER_IMPORT_TOOL_KEYS.COMMIT, ...session.commitResult, idempotentReplay: true }
  }
  const result = await commitCustomerImportSession(pool, req, session, {
    idempotencyKey,
    duplicatePolicy: input.duplicatePolicy ?? CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP,
    confirmed: input.confirmed === true,
  })
  updateCustomerImportSession(input.importSessionId, userId, gaId, {
    commitStatus: 'committed',
    commitResult: result,
    lastCommitIdempotencyKey: idempotencyKey || session.lastCommitIdempotencyKey,
  })
  return { toolKey: CUSTOMER_IMPORT_TOOL_KEYS.COMMIT, ...result }
}

async function toolFailureReport(req, input) {
  const userId = String(req.user?.id ?? req.user?.userId ?? '')
  const gaId = Number(req.user?.gaId)
  const session = getCustomerImportSession(input.importSessionId, userId, gaId)
  const commit = session.commitResult
  const rows = session.rows ?? []
  return {
    toolKey: CUSTOMER_IMPORT_TOOL_KEYS.FAILURE_REPORT,
    importSessionId: input.importSessionId,
    excluded: rows.filter((r) => !r.eligibleForCommit).map((r) => ({
      rowId: r.rowId,
      sourceRowNumber: r.sourceRowNumber,
      status: r.status,
      reasons: r.reasons,
      duplicate: r.duplicate,
    })),
    failures: commit?.failures ?? [],
    skipped: commit?.skipped ?? [],
    summary: commit?.summary ?? buildImportPreviewSummary(rows),
  }
}
