/**
 * Multer/busboy often provides originalname as latin1 bytes of UTF-8 filenames.
 * @param {string} name
 */
export function normalizeUploadedFileName(name) {
  const raw = String(name ?? '').trim()
  if (!raw) {
    return ''
  }
  if (!/[\u0080-\u00ff]/.test(raw) && !raw.includes('í') && !raw.includes('ì')) {
    return raw
  }
  try {
    const decoded = Buffer.from(raw, 'latin1').toString('utf8').trim()
    if (decoded && decoded !== raw) {
      return decoded
    }
  } catch {
    /* keep raw */
  }
  return raw
}
