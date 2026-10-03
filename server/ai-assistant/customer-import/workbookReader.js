import * as XLSX from 'xlsx'

/**
 * @param {Buffer} buffer
 * @param {'xlsx'|'xls'|'csv'} fileType
 */
export function readWorkbookFromBuffer(buffer, fileType) {
  try {
    const bookType = fileType === 'csv' ? 'string' : 'buffer'
    const data = fileType === 'csv' ? buffer.toString('utf8') : buffer
    const wb = XLSX.read(data, { type: bookType, cellDates: true, codepage: 65001 })
    const sheets = wb.SheetNames.map((name) => {
      const sheet = wb.Sheets[name]
      const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
      return { name, matrix }
    })
    return { sheets }
  } catch {
    throw Object.assign(new Error('MALFORMED_FILE'), { code: 'MALFORMED_FILE' })
  }
}
