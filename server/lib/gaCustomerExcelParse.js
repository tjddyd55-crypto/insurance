export function normalizeGaHeaderName(value) {
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
]

const KNOWN_GA_HEADER_SET = new Set(KNOWN_GA_HEADERS.map((header) => normalizeGaHeaderName(header)))

function cellToHeaderDetectString(value) {
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

export function detectGaExcelHeaderRow(rows) {
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

export function headerCellToLabel(value, index) {
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

function excelCellToStoredString(value) {
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

function isRowEmpty(values) {
  return values.every((value) => String(value).trim() === '')
}

export function parseGaExcelMatrix(matrix, matrixRaw) {
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

  const dataRows = []
  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex]
    const cells = {}
    const storedValues = []

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

export function isKnownGaHeaderLabel(label) {
  return KNOWN_GA_HEADER_SET.has(normalizeGaHeaderName(label))
}
