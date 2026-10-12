import type { PersonalBinderMaterial } from '../personalBinder.types'

export function splitBinderFileDisplayName(material: PersonalBinderMaterial): {
  baseName: string
  extension: string
} {
  const raw = String(material.displayName ?? material.originalFileName ?? material.title ?? '자료').trim()
  const dot = raw.lastIndexOf('.')
  if (dot > 0 && dot < raw.length - 1) {
    return {
      baseName: raw.slice(0, dot),
      extension: raw.slice(dot + 1).toUpperCase(),
    }
  }
  const mime = String(material.mimeType ?? '').toLowerCase()
  if (mime === 'application/pdf') return { baseName: raw, extension: 'PDF' }
  if (mime === 'image/png') return { baseName: raw, extension: 'PNG' }
  if (mime === 'image/jpeg') return { baseName: raw, extension: 'JPG' }
  return { baseName: raw, extension: 'FILE' }
}
