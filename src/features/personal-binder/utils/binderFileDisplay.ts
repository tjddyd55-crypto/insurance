import type { PersonalBinderMaterial } from '../personalBinder.types'

export type BinderMaterialRenderKind = 'pdf' | 'image'

/** 서버 `normalizeBinderMaterialMime` 와 동일한 판별 (Viewer·편집기 공통). */
export function normalizeBinderMaterialMime(mime: string, fileName: string): string {
  const normalized = String(mime ?? '').toLowerCase().split(';')[0].trim()
  if (
    normalized === 'application/pdf' ||
    normalized === 'image/jpeg' ||
    normalized === 'image/jpg' ||
    normalized === 'image/png'
  ) {
    return normalized === 'image/jpg' ? 'image/jpeg' : normalized
  }
  const lower = String(fileName ?? '').toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.png')) return 'image/png'
  return normalized
}

export function resolveBinderMaterialRenderKind(
  material: PersonalBinderMaterial,
): BinderMaterialRenderKind {
  const mime = normalizeBinderMaterialMime(material.mimeType, material.originalFileName)
  if (mime.startsWith('image/')) return 'image'
  return 'pdf'
}

export function isBinderImageMaterial(material: PersonalBinderMaterial): boolean {
  return resolveBinderMaterialRenderKind(material) === 'image'
}

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
