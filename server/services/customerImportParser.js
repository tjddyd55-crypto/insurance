import xlsx from 'xlsx'

const ALLOWED_EXT = ['.xlsx', '.xls', '.csv']

export function assertImportFilenameAllowed(filename) {
  const lower = String(filename ?? '').toLowerCase()
  return ALLOWED_EXT.some((ext) => lower.endsWith(ext))
}

/**
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {{ headers: string[], rows: { rowIndex: number, raw: Record<string, unknown> }[] }}
 */
export function parseCustomerImportBuffer(buffer, filename) {
  if (!buffer || buffer.length === 0) {
    return { headers: [], rows: [] }
  }
  const lower = String(filename ?? '').toLowerCase()
  let workbook
  if (lower.endsWith('.csv')) {
    const text = buffer.toString('utf8')
    workbook = xlsx.read(text, { type: 'string', raw: false })
  } else {
    workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true })
  }
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { headers: [], rows: [] }
  }
  const sheet = workbook.Sheets[sheetName]
  const matrixRaw = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const matrix = Array.isArray(matrixRaw) ? matrixRaw : []
  if (matrix.length === 0) {
    return { headers: [], rows: [] }
  }
  const headers = matrix[0].map((h) => String(h ?? '').trim())
  const rows = []
  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i]
    if (!Array.isArray(line)) {
      continue
    }
    const nonEmpty = line.some((c) => String(c ?? '').trim() !== '')
    if (!nonEmpty) {
      continue
    }
    /** @type {Record<string, unknown>} */
    const raw = {}
    for (let j = 0; j < headers.length; j += 1) {
      const label = headers[j] && String(headers[j]).trim() ? String(headers[j]).trim() : `__col_${j}`
      raw[label] = line[j]
    }
    rows.push({ rowIndex: i + 1, raw })
  }
  return { headers, rows }
}

export function chunkArray(arr, chunkSize) {
  const out = []
  for (let i = 0; i < arr.length; i += chunkSize) {
    out.push(arr.slice(i, i + chunkSize))
  }
  return out
}
