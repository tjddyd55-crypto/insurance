export const CUSTOMER_IMPORT_FILE_LIMITS = Object.freeze({
  maxBytes: 20 * 1024 * 1024,
  maxRows: 5000,
  maxColumns: 100,
  sessionTtlMs: 24 * 60 * 60 * 1000,
  maxSampleRows: 5,
})

export const CUSTOMER_IMPORT_ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv'])

export const CUSTOMER_IMPORT_MIME_HINTS = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'text/plain',
])

export const CUSTOMER_IMPORT_ROW_STATUS = Object.freeze({
  VALID: 'VALID',
  WARNING: 'WARNING',
  INVALID: 'INVALID',
})

export const CUSTOMER_IMPORT_REASON = Object.freeze({
  MISSING_CUSTOMER_NAME: 'MISSING_CUSTOMER_NAME',
  INVALID_PHONE: 'INVALID_PHONE',
  EMPTY_ROW: 'EMPTY_ROW',
  UNKNOWN_FIELD: 'UNKNOWN_FIELD',
  DUPLICATE_IN_FILE: 'DUPLICATE_IN_FILE',
  DUPLICATE_EXISTING_CUSTOMER: 'DUPLICATE_EXISTING_CUSTOMER',
  DUPLICATE_POSSIBLE_NAME: 'DUPLICATE_POSSIBLE_NAME',
  UNSUPPORTED_VALUE: 'UNSUPPORTED_VALUE',
})

export const CUSTOMER_IMPORT_DUPLICATE_POLICY = Object.freeze({
  SKIP: 'SKIP',
  INCLUDE: 'INCLUDE',
})
