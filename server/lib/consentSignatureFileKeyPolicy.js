/**
 * consent/signature JWT file download key 검증 SSOT.
 */

/**
 * @param {string} rawKey
 */
export function normalizeStorageObjectKey(rawKey) {
  const key = String(rawKey ?? '')
    .trim()
    .replace(/^\//, '')
    .replace(/\\/g, '/')
  if (!key || key.includes('..') || key.includes('\0')) {
    return ''
  }
  return key
}

/**
 * consent result PDF key — insurer/{gaPath}/{userSeg}/customers/{customerId}/consents/{yyyy}/{mm}/{dd}/...
 * @param {string} rawKey
 */
export function isAllowedConsentResultFileKey(rawKey) {
  const key = normalizeStorageObjectKey(rawKey)
  if (!key) {
    return false
  }
  return /^insurer\/[^/]+\/[^/]+\/customers\/[^/]+\/consents\/\d{4}\/\d{2}\/\d{2}\/[^/]+\.pdf$/i.test(key)
}

/**
 * signature PNG key — signatures/{gaId}/{customerPath}/{signatureId}.png
 * @param {string} rawKey
 */
export function isAllowedSignatureFileKey(rawKey) {
  const key = normalizeStorageObjectKey(rawKey)
  if (!key) {
    return false
  }
  return /^signatures\/\d+\/[^/]+\/[^/]+\.png$/i.test(key)
}
