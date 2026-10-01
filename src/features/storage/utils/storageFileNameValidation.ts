/** Storage display/original filename validation — backend `storageFileNameValidation.js` parity. */

export const FILE_NAME_MAX_LENGTH = 120

const DISALLOWED_DISPLAY_FILENAME = /[\\/<>?*|"\r\n\u0000]/

function normalizeSpaces(raw: string): string {
  return String(raw ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizeStorageFileName(raw: string, maxLength = FILE_NAME_MAX_LENGTH): string {
  const value = normalizeSpaces(raw)
  if (!value) {
    return ''
  }
  return value.slice(0, maxLength)
}

export function isValidStorageFileName(raw: string, maxLength = FILE_NAME_MAX_LENGTH): boolean {
  const value = normalizeStorageFileName(raw, maxLength)
  if (!value) {
    return false
  }
  if (DISALLOWED_DISPLAY_FILENAME.test(value)) {
    return false
  }
  return true
}
