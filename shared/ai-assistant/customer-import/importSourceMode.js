export const CUSTOMER_IMPORT_SOURCE_MODE = Object.freeze({
  TABULAR: 'TABULAR',
  UNSTRUCTURED_CELL_RECORDS: 'UNSTRUCTURED_CELL_RECORDS',
})

/**
 * @param {Array<{ name: string, matrix: unknown[][] }>} sheets
 */
export function detectWorkbookImportSourceMode(sheets) {
  const primary = sheets.find((s) => s.name === '고객정보') ?? sheets[0]
  if (!primary?.matrix) {
    return CUSTOMER_IMPORT_SOURCE_MODE.TABULAR
  }
  const stats = sheetNonEmptyStats(primary.matrix)
  if (stats.columnCount >= 80 && stats.rowCount <= 40 && stats.multilineRatio >= 0.5) {
    return CUSTOMER_IMPORT_SOURCE_MODE.UNSTRUCTURED_CELL_RECORDS
  }
  if (stats.multilineRatio >= 0.35 && stats.columnCount >= 30) {
    return CUSTOMER_IMPORT_SOURCE_MODE.UNSTRUCTURED_CELL_RECORDS
  }
  return CUSTOMER_IMPORT_SOURCE_MODE.TABULAR
}

function sheetNonEmptyStats(matrix) {
  const rows = Array.isArray(matrix) ? matrix : []
  let nonEmpty = 0
  let multiline = 0
  const columnCount = rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0)
  for (const row of rows) {
    if (!Array.isArray(row)) {
      continue
    }
    for (const cell of row) {
      const text = String(cell ?? '').trim()
      if (!text) {
        continue
      }
      nonEmpty += 1
      if (text.includes('\n') || text.length > 60) {
        multiline += 1
      }
    }
  }
  return {
    rowCount: rows.length,
    columnCount,
    nonEmptyCells: nonEmpty,
    multilineRatio: nonEmpty > 0 ? multiline / nonEmpty : 0,
  }
}

export function summarizeUnstructuredWorkbook(sheets, sheetName = '고객정보') {
  const sheet = sheets.find((s) => s.name === sheetName) ?? sheets[0]
  const stats = sheet ? sheetNonEmptyStats(sheet.matrix) : { nonEmptyCells: 0, columnCount: 0, rowCount: 0, multilineRatio: 0 }
  return {
    primarySheetName: sheet?.name ?? null,
    nonEmptyCells: stats.nonEmptyCells,
    columnCount: stats.columnCount,
    rowCount: stats.rowCount,
    multilineCellRatio: stats.multilineRatio,
  }
}
