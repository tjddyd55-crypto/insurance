export function normalizeImportString(value) {
  if (value == null) {
    return ''
  }
  return String(value).replace(/\s+/g, ' ').trim()
}

/**
 * @param {unknown} value
 * @returns {{ normalized: string, valid: boolean }}
 */
export function normalizeImportPhone(value) {
  if (value == null || value === '') {
    return { normalized: '', valid: false }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const digits = String(Math.trunc(value))
    if (digits.length >= 9 && digits.length <= 11) {
      return { normalized: digits, valid: digits.length >= 10 }
    }
  }
  const raw = String(value).trim()
  const digits = raw.replace(/\D/g, '')
  if (!digits) {
    return { normalized: '', valid: false }
  }
  if (digits.length < 9 || digits.length > 11) {
    return { normalized: digits, valid: false }
  }
  return { normalized: digits, valid: digits.length >= 10 }
}

export function cellToImportString(value) {
  if (value == null || value === '') {
    return ''
  }
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return normalizeImportString(value)
}
