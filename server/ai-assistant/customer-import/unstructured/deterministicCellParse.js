import {
  cellToImportString,
  cellToImportStringPreserveLines,
} from '../../../../shared/ai-assistant/customer-import/normalize.js'
import { redactSensitiveForExternalModel, stripHighRiskFieldsFromMemo } from './sensitiveRedact.js'

const PHONE_LINE = /(?:핸드폰|휴대|전화|H\.?P|연락처|모바일|Mobile)\s*[:：]?\s*([0-9\s\-().]{9,20})/i
const NAME_LINE = /(?:^|\n)\s*(?:이름|성명|고객명)\s*[:：]\s*([^\n\r]+)/i
const ADDRESS_LINE = /(?:주소|거주지|Address)\s*[:：]\s*([^\n\r]+)/i
const JOB_LINE = /(?:직업|회사|하는일|지역)\s*[:：]\s*([^\n\r]+)/i
const FIELD_LABEL_LINE =
  /^(?:주민번호|핸드폰|휴대|전화|주소|키\s*\/\s*몸무게|직업|회사|병원|보험|메모|계좌|청구)/i
const LEADING_NAME_ON_SAME_LINE = /^([가-힣]{2,8})(?=\s+(?:주민|키\/|핸드|휴대|전화|주소|직업|회사|병력|보험))/i

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

function sanitizeNameToken(token) {
  const cleaned = String(token ?? '')
    .replace(/^(이름|성명|고객명)\s*[:：]\s*/i, '')
    .trim()
    .split(/\s+/)[0]
  if (!cleaned || FIELD_LABEL_LINE.test(cleaned)) {
    return ''
  }
  if (/[0-9:：]/.test(cleaned)) {
    return ''
  }
  if (cleaned.length > 12) {
    return ''
  }
  return cleaned
}

/**
 * Extract person name only — never return raw cell / block text.
 * @param {string} text
 */
export function extractPersonNameFromBlock(text) {
  const raw = String(text ?? '')
  const fromLabel = NAME_LINE.exec(raw)?.[1]?.trim()
  if (fromLabel) {
    const labeled = sanitizeNameToken(fromLabel)
    if (labeled) {
      return labeled
    }
  }

  const leading = LEADING_NAME_ON_SAME_LINE.exec(raw)
  if (leading?.[1]) {
    return sanitizeNameToken(leading[1])
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (FIELD_LABEL_LINE.test(line)) {
      continue
    }
    if (PHONE_LINE.test(line)) {
      continue
    }
    if (/^([가-힣]{2,8})$/.test(line)) {
      return line
    }
    const inline = LEADING_NAME_ON_SAME_LINE.exec(line)
    if (inline?.[1]) {
      return sanitizeNameToken(inline[1])
    }
  }

  return ''
}

function extractAddress(text) {
  const fromLabel = ADDRESS_LINE.exec(text)?.[1]?.trim() ?? ''
  if (!fromLabel) {
    return ''
  }
  const trimmed = fromLabel.split(/\r?\n/)[0].trim()
  if (/\d{6}[-\s]?\d{7}/.test(trimmed) || /01[016789]/.test(trimmed.replace(/\D/g, ''))) {
    return ''
  }
  if (/주민번호|핸드폰|직업|보험|병력/i.test(trimmed)) {
    return ''
  }
  return trimmed.slice(0, 200)
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
  const text = cellToImportStringPreserveLines(cellValue)
  if (!text.trim()) {
    return { kind: 'EMPTY', records: [], sourceText: text }
  }
  const cellRef = `${columnIndexToLetters(colIndex)}${rowIndex + 1}`
  const sourceCell = `${sheetName}!${cellRef}`

  if (/^(경정청구|보험|메모|계좌)/.test(text) && extractPhones(text).length === 0 && !NAME_LINE.test(text)) {
    return { kind: 'NON_CUSTOMER', records: [], sourceCell, sourceText: text }
  }

  const phones = extractPhones(text)
  const personName = extractPersonNameFromBlock(text)
  const address = extractAddress(text)
  const job = JOB_LINE.exec(text)?.[1]?.trim().split(/\r?\n/)[0]?.slice(0, 80) ?? ''

  const records = []
  if (phones.length === 0 && !personName) {
    return { kind: 'REVIEW_REQUIRED', records: [], sourceCell, sourceText: text, warnings: ['NO_NAME_OR_PHONE'] }
  }

  if (phones.length <= 1) {
    const memo = stripHighRiskFieldsFromMemo(
      text
        .split(/\r?\n/)
        .filter((line) => !PHONE_LINE.test(line) && !NAME_LINE.test(line) && !ADDRESS_LINE.test(line))
        .join('\n'),
    )
    const hasStrongIdentity = Boolean(personName && phones[0])
    records.push({
      sourceCell,
      sourceRecordIndex: 0,
      name: personName,
      phone: phones[0] ?? '',
      address,
      job,
      memo: memo.slice(0, 500),
      confidence: hasStrongIdentity ? 0.85 : 0.55,
      warnings: phones[0] ? (personName ? [] : ['MISSING_NAME']) : ['MISSING_PHONE'],
      classification: hasStrongIdentity ? 'CUSTOMER_CANDIDATE' : 'REVIEW_REQUIRED',
      sourceText: text,
    })
    return { kind: records[0].classification, records, sourceCell, sourceText: text }
  }

  phones.forEach((phone, index) => {
    records.push({
      sourceCell,
      sourceRecordIndex: index,
      name: index === 0 ? personName : personName ? `${personName} (${index + 1})` : '',
      phone,
      address: index === 0 ? address : '',
      job: index === 0 ? job : '',
      memo: '',
      confidence: 0.6,
      warnings: ['MULTI_PERSON_CELL'],
      classification: 'REVIEW_REQUIRED',
      sourceText: text,
    })
  })
  return { kind: 'MULTI_PERSON', records, sourceCell, sourceText: text }
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
