import { CUSTOMER_IMPORT_FIELD_KEYS } from '../../../shared/ai-assistant/customer-import/fieldDictionary.js'

const SENSITIVE_HEADER_PATTERN = /(주민|ssn|resident|password|비밀)/i

function maskPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length < 8) {
    return '***'
  }
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`
}

function sanitizeSampleCell(header, value) {
  const h = String(header ?? '').trim()
  const raw = String(value ?? '').trim()
  if (!raw) {
    return ''
  }
  if (SENSITIVE_HEADER_PATTERN.test(h)) {
    return '[redacted]'
  }
  if (/phone|휴대|연락|hp|h\.p|mobile|tel/i.test(h)) {
    return maskPhone(raw)
  }
  if (/memo|비고|특이|note/i.test(h)) {
    return raw.length > 24 ? `${raw.slice(0, 24)}…` : raw
  }
  if (/주소|address/i.test(h)) {
    return raw.length > 16 ? `${raw.slice(0, 16)}…` : raw
  }
  return raw.length > 32 ? `${raw.slice(0, 32)}…` : raw
}

/**
 * GPT column-map용 최소·sanitized workbook context
 */
export function buildSanitizedColumnMapContext(session) {
  const headers = session.headers ?? []
  const sampleRows = (session.sampleRows ?? []).slice(0, 5)
  const columnStats = headers.map((header, index) => {
    const samples = sampleRows.map((row) => sanitizeSampleCell(header, row.cells?.[index]))
    return {
      sourceColumn: String(header),
      nonEmptySampleCount: samples.filter(Boolean).length,
      samples,
    }
  })

  return {
    importSessionId: session.importSessionId,
    selectedSheetName: session.selectedSheetName,
    headerRowIndex: session.headerRowIndex,
    headers,
    columnStats,
    availableFields: CUSTOMER_IMPORT_FIELD_KEYS.map((key) => ({ key })),
    existingAliasHints: session.columnMapping ?? {},
    untrustedWorkbookData: true,
  }
}
