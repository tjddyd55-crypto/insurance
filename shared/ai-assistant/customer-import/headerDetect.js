import { cellToImportString } from './normalize.js'

function rowNonEmptyCount(row) {
  if (!Array.isArray(row)) {
    return 0
  }
  return row.filter((c) => cellToImportString(c) !== '').length
}

function rowStringRatio(row) {
  const cells = Array.isArray(row) ? row : []
  const nonEmpty = cells.filter((c) => cellToImportString(c) !== '')
  if (nonEmpty.length === 0) {
    return 0
  }
  const strings = nonEmpty.filter((c) => typeof c === 'string' || c instanceof Date)
  return strings.length / nonEmpty.length
}

/**
 * @param {unknown[][]} matrix
 * @param {number} [scanRows]
 */
export function scoreHeaderRowCandidates(matrix, scanRows = 15) {
  const rows = Array.isArray(matrix) ? matrix : []
  const limit = Math.min(scanRows, rows.length)
  const candidates = []
  for (let index = 0; index < limit; index += 1) {
    const row = rows[index] ?? []
    const labels = row.map((c, i) => cellToImportString(c) || `열 ${i + 1}`)
    const nonEmpty = rowNonEmptyCount(row)
    const stringRatio = rowStringRatio(row)
    let score = nonEmpty * 2 + stringRatio * 10
    if (nonEmpty >= 2 && stringRatio >= 0.6) {
      score += 5
    }
    candidates.push({
      rowIndex: index,
      score,
      headers: labels,
      nonEmptyCellCount: nonEmpty,
    })
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates
}

export function pickSuggestedHeaderRowIndex(candidates) {
  if (!candidates.length) {
    return 0
  }
  const top = candidates[0]
  if (top.score < 4) {
    return 0
  }
  return top.rowIndex
}
