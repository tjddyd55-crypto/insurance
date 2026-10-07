import path from 'node:path'

import { CUSTOMER_IMPORT_ALLOWED_EXTENSIONS, CUSTOMER_IMPORT_FILE_LIMITS } from './constants.js'
import { scoreHeaderRowCandidates, pickSuggestedHeaderRowIndex } from './headerDetect.js'
import { cellToImportString } from './normalize.js'

/**
 * @param {string} originalFileName
 */
export function detectCustomerImportFileType(originalFileName) {
  const ext = path.extname(String(originalFileName ?? '')).toLowerCase()
  if (ext === '.csv') {
    return 'csv'
  }
  if (ext === '.xlsx') {
    return 'xlsx'
  }
  if (ext === '.xls') {
    return 'xls'
  }
  return null
}

export function assertCustomerImportFileMeta({ originalFileName, byteLength, mimeType }) {
  const ext = path.extname(String(originalFileName ?? '')).toLowerCase()
  if (!CUSTOMER_IMPORT_ALLOWED_EXTENSIONS.has(ext)) {
    throw Object.assign(new Error('UNSUPPORTED_FILE_TYPE'), { code: 'UNSUPPORTED_FILE_TYPE' })
  }
  if (!Number.isFinite(byteLength) || byteLength <= 0) {
    throw Object.assign(new Error('EMPTY_FILE'), { code: 'EMPTY_FILE' })
  }
  if (byteLength > CUSTOMER_IMPORT_FILE_LIMITS.maxBytes) {
    throw Object.assign(new Error('FILE_TOO_LARGE'), { code: 'FILE_TOO_LARGE' })
  }
  const mime = String(mimeType ?? '').toLowerCase()
  if (mime && !mime.includes('octet-stream') && !mime.includes('spreadsheet') && !mime.includes('csv') && !mime.includes('excel') && mime !== 'text/plain' && mime !== 'application/vnd.ms-excel') {
    // filename + parser 결과를 우선 — mime 은 참고만
  }
  return detectCustomerImportFileType(originalFileName)
}

/**
 * @param {unknown[][]} matrix
 */
export function matrixSheetStats(matrix) {
  const rows = Array.isArray(matrix) ? matrix : []
  const rowCount = rows.length
  const columnCount = rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0)
  let emptyRows = 0
  for (const row of rows) {
    if (!Array.isArray(row) || row.every((c) => cellToImportString(c) === '')) {
      emptyRows += 1
    }
  }
  const emptyRowRatio = rowCount > 0 ? emptyRows / rowCount : 1
  return { rowCount, columnCount, emptyRowRatio }
}

/**
 * @param {unknown[][]} matrix
 * @param {number} headerRowIndex
 */
export function buildAnalyzeResultForMatrix(matrix, headerRowIndex) {
  const stats = matrixSheetStats(matrix)
  if (stats.columnCount > CUSTOMER_IMPORT_FILE_LIMITS.maxColumns) {
    throw Object.assign(new Error('TOO_MANY_COLUMNS'), { code: 'TOO_MANY_COLUMNS' })
  }
  if (stats.rowCount > CUSTOMER_IMPORT_FILE_LIMITS.maxRows) {
    throw Object.assign(new Error('TOO_MANY_ROWS'), { code: 'TOO_MANY_ROWS' })
  }
  const candidates = scoreHeaderRowCandidates(matrix)
  const headerIndex = Number.isInteger(headerRowIndex) ? headerRowIndex : pickSuggestedHeaderRowIndex(candidates)
  const headerRow = matrix[headerIndex] ?? []
  const headers = headerRow.map((c, i) => cellToImportString(c) || `열 ${i + 1}`)
  const dataRows = matrix.slice(headerIndex + 1)
  const sampleRows = dataRows
    .filter((row) => Array.isArray(row) && row.some((c) => cellToImportString(c) !== ''))
    .slice(0, CUSTOMER_IMPORT_FILE_LIMITS.maxSampleRows)
    .map((row, i) => ({
      sourceRowNumber: headerIndex + 2 + i,
      cells: headers.map((_, colIndex) => cellToImportString(row[colIndex])),
    }))

  return {
    headerRowIndex: headerIndex,
    headerCandidates: candidates.slice(0, 5),
    headers,
    stats,
    sampleRows,
  }
}
