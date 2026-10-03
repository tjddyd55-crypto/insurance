import { cellToImportString } from '../../../../shared/ai-assistant/customer-import/normalize.js'
import { redactSensitiveForExternalModel, stripHighRiskFieldsFromMemo } from './sensitiveRedact.js'

const PHONE_LINE = /(?:핸드폰|휴대|전화|H\.?P|연락처|모바일|Mobile)\s*[:：]?\s*([0-9\s\-().]{9,20})/i
const NAME_LINE = /(?:^|\n)\s*(?:이름|성명|고객명)\s*[:：]\s*([^\n\r]+)/i
const ADDRESS_LINE = /(?:주소|거주지|Address)\s*[:：]\s*([^\n\r]+)/i
const JOB_LINE = /(?:직업|회사|하는일|지역)\s*[:：]\s*([^\n\r]+)/i

function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 11) {
    return ''
  }
  if (digits.length === 10) {
    return `0${digits}`
  }
  return digits
}

function firstLineName(text) {
  const first = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !/^\d{6}/.test(l) && !PHONE_LINE.test(l))
  if (!first) {
    return ''
  }
  const cleaned = first.replace(/^(이름|성명)\s*[:：]\s*/i, '').trim()
  if (cleaned.length > 40 || /\d{5,}/.test(cleaned)) {
    return ''
  }
  return cleaned
}

function extractPhones(text) {
  const found = new Set()
  const labeled = text.match(new RegExp(PHONE_LINE.source, 'gi')) ?? []
  for (const block of labeled) {
    const m = block.match(PHONE_LINE)
    if (m?.[1]) {
      const p = normalizePhone(m[1])
      if (p) {
        found.add(p)
      }
    }
  }
  const loose = String(text ?? '').match(/01[016789][\s\-]?\d{3,4}[\s\-]?\d{4}/g) ?? []
  for (const raw of loose) {
    const p = normalizePhone(raw)
    if (p) {
      found.add(p)
    }
  }
  return [...found]
}

/**
 * @param {string} sheetName
 * @param {number} rowIndex
 * @param {number} colIndex
 * @param {unknown} cellValue
 */
export function parseUnstructuredCellDeterministic(sheetName, rowIndex, colIndex, cellValue) {
  const text = cellToImportString(cellValue)
  if (!text.trim()) {
    return { kind: 'EMPTY', records: [] }
  }
  const cellRef = `${columnIndexToLetters(colIndex)}${rowIndex + 1}`
  const sourceCell = `${sheetName}!${cellRef}`

  if (/^(경정청구|보험|메모|계좌)/.test(text) && extractPhones(text).length === 0 && !NAME_LINE.test(text)) {
    return { kind: 'NON_CUSTOMER', records: [], sourceCell }
  }

  const phones = extractPhones(text)
  const nameFromLabel = NAME_LINE.exec(text)?.[1]?.trim() ?? ''
  const address = ADDRESS_LINE.exec(text)?.[1]?.trim() ?? ''
  const job = JOB_LINE.exec(text)?.[1]?.trim() ?? ''
  const fallbackName = nameFromLabel || firstLineName(text)

  const records = []
  if (phones.length === 0 && !fallbackName) {
    return { kind: 'REVIEW_REQUIRED', records: [], sourceCell, warnings: ['NO_NAME_OR_PHONE'] }
  }

  if (phones.length <= 1) {
    const memo = stripHighRiskFieldsFromMemo(
      text
        .split(/\r?\n/)
        .filter((line) => !PHONE_LINE.test(line) && !NAME_LINE.test(line) && !ADDRESS_LINE.test(line))
        .join('\n'),
    )
    records.push({
      sourceCell,
      sourceRecordIndex: 0,
      name: fallbackName,
      phone: phones[0] ?? '',
      address,
      job,
      memo: memo.slice(0, 500),
      confidence: phones[0] && fallbackName ? 0.85 : 0.55,
      warnings: phones[0] ? [] : ['MISSING_PHONE'],
      classification: phones[0] && fallbackName ? 'CUSTOMER_CANDIDATE' : 'REVIEW_REQUIRED',
    })
    return { kind: records[0].classification, records, sourceCell }
  }

  phones.forEach((phone, index) => {
    records.push({
      sourceCell,
      sourceRecordIndex: index,
      name: index === 0 ? fallbackName : `${fallbackName || '고객'} (${index + 1})`,
      phone,
      address: index === 0 ? address : '',
      job: index === 0 ? job : '',
      memo: '',
      confidence: 0.6,
      warnings: ['MULTI_PERSON_CELL'],
      classification: 'REVIEW_REQUIRED',
    })
  })
  return { kind: 'MULTI_PERSON', records, sourceCell }
}

export function prepareCellForGpt(sheetName, rowIndex, colIndex, cellValue) {
  const text = cellToImportString(cellValue)
  const { redactedText } = redactSensitiveForExternalModel(text)
  const cellRef = `${columnIndexToLetters(colIndex)}${rowIndex + 1}`
  return {
    sourceCell: `${sheetName}!${cellRef}`,
    redactedText: redactedText.slice(0, 2000),
  }
}

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
