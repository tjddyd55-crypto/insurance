/** Storage display/original filename validation — opaque string, path-safe deny-list. */

export const FILE_NAME_MAX_LENGTH = 120

/** Path separators, wildcards, quotes, control chars — not allowed in display names. */
const DISALLOWED_DISPLAY_FILENAME = /[\\/<>?*|"\r\n\u0000]/

function normalizeSpaces(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizeStorageFileName(raw, maxLength = FILE_NAME_MAX_LENGTH) {
  const value = normalizeSpaces(raw)
  if (!value) {
    return ''
  }
  return value.slice(0, maxLength)
}

export function isValidStorageFileName(raw, maxLength = FILE_NAME_MAX_LENGTH) {
  const value = normalizeStorageFileName(raw, maxLength)
  if (!value) {
    return false
  }
  if (DISALLOWED_DISPLAY_FILENAME.test(value)) {
    return false
  }
  return true
}

/** R2/S3 object key segment — original display name과 분리된 safe filename. */
export function sanitizeStorageFileNameForObjectKey(fileNameRaw, maxLength = FILE_NAME_MAX_LENGTH) {
  const normalized = normalizeStorageFileName(fileNameRaw, maxLength)
  const safe =
    normalized
      .replace(/[^\w.\-()\u3131-\u318e\uac00-\ud7a3]/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, maxLength) || 'file'
  return safe
}
