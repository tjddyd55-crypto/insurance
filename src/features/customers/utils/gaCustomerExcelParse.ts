export function normalizeGaHeaderName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
}

export const KNOWN_GA_HEADERS = [
  '증권번호',
  '차량번호',
  '차명',
  '원수사',
  '상품명',
  '상품구분',
  '상품분류',
  '모집인',
  '계약일자',
  '계약자',
  '피보험자',
  '보험료',
  '갱신후보험료',
  '원수사환산',
  '영진환산',
  '월초대비환산율',
  '유지환산',
  '2차환산',
  '3차환산',
  '수수료',
  '납입방법',
  '납입기간',
  '보험기간',
  '개시일자',
  '만기일자',
  '이체일자',
  '상태',
  '소멸일자',
  '납회',
  '납월',
] as const

const KNOWN_GA_HEADER_SET = new Set(KNOWN_GA_HEADERS.map((header) => normalizeGaHeaderName(header)))

function cellToHeaderDetectString(value: unknown): string {
  if (value == null || value === '') {
    return ''
  }
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return normalizeGaHeaderName(`${y}-${m}-${d}`)
  }
  return normalizeGaHeaderName(value)
}

/**
 * 첫 20행 중 핵심 GA 헤더가 가장 많이 일치하는 행을 헤더로 선택한다.
 * score가 3 미만이면 0행을 헤더로 유지한다(기존 1행 헤더 파일 호환).
 */
export function detectGaExcelHeaderRow(rows: unknown[][]): number {
  let bestIndex = 0
  let bestScore = 0

  rows.slice(0, 20).forEach((row, index) => {
    const normalizedCells = (Array.isArray(row) ? row : []).map(cellToHeaderDetectString)
    const score = KNOWN_GA_HEADERS.reduce((sum, header) => {
      return sum + (normalizedCells.includes(normalizeGaHeaderName(header)) ? 1 : 0)
    }, 0)

    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  return bestScore >= 3 ? bestIndex : 0
}

export function headerCellToLabel(value: unknown, index: number): string {
  if (value == null || value === '') {
    return `열 ${index + 1}`
  }
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(value).trim() || `열 ${index + 1}`
}

export type GaExcelParsedColumn = {
  id: string
  header: string
  index: number
}

export type GaExcelParsedRow = {
  rowIndex: number
  cells: Record<string, string>
}

function excelCellToStoredString(value: unknown): string {
  if (value == null || value === '') {
    return ''
  }
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(value)
}

function isRowEmpty(values: string[]): boolean {
  return values.every((value) => value.trim() === '')
}

/**
 * GA 엑셀 matrix를 컬럼·데이터 행으로 파싱한다.
 * headerRowIndex 이전 행은 제목/안내 행으로 제외한다.
 */
export function parseGaExcelMatrix(
  matrix: unknown[][],
  matrixRaw?: unknown[][],
): { headerRowIndex: number; columns: GaExcelParsedColumn[]; dataRows: GaExcelParsedRow[] } {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new Error('EMPTY_SHEET')
  }

  const headerRowIndex = detectGaExcelHeaderRow(matrix)
  const headerSource = Array.isArray(matrixRaw?.[headerRowIndex])
    ? matrixRaw[headerRowIndex]
    : matrix[headerRowIndex]

  if (!Array.isArray(headerSource)) {
    throw new Error('BAD_HEADER')
  }

  const columns = headerSource.map((header, index) => ({
    id: `col_${index}`,
    header: headerCellToLabel(header, index),
    index,
  }))

  const dataRows: GaExcelParsedRow[] = []
  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex]
    const cells: Record<string, string> = {}
    const storedValues: string[] = []

    for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
      const value = Array.isArray(row) ? row[colIndex] : undefined
      const stored = excelCellToStoredString(value)
      cells[columns[colIndex].id] = stored
      storedValues.push(stored)
    }

    if (!isRowEmpty(storedValues)) {
      dataRows.push({
        rowIndex: rowIndex + 1,
        cells,
      })
    }
  }

  return { headerRowIndex, columns, dataRows }
}

export function isKnownGaHeaderLabel(label: string): boolean {
  return KNOWN_GA_HEADER_SET.has(normalizeGaHeaderName(label))
}
