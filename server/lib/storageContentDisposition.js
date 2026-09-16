/**
 * Storage download Content-Disposition — 한글·쉼표 등은 filename* (RFC 5987).
 * @param {string} displayNameRaw
 */
export function buildAttachmentContentDisposition(displayNameRaw) {
  const name = String(displayNameRaw ?? '').trim() || 'download'
  const ascii =
    name
      .replace(/["\r\n\\]/g, '_')
      .replace(/[^\x20-\x7E]/g, '_')
      .trim()
      .slice(0, 200) || 'download'
  const star = encodeURIComponent(name)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${star}`
}

/**
 * @param {string} displayNameRaw
 */
export function buildInlineContentDisposition(displayNameRaw) {
  const name = String(displayNameRaw ?? '').trim() || 'document'
  const ascii =
    name
      .replace(/["\r\n\\]/g, '_')
      .replace(/[^\x20-\x7E]/g, '_')
      .trim()
      .slice(0, 200) || 'document'
  const star = encodeURIComponent(name)
  return `inline; filename="${ascii}"; filename*=UTF-8''${star}`
}
