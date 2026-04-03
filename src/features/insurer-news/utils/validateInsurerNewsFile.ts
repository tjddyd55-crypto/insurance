const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const PDF_TYPES = new Set(['application/pdf'])

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_PDF_BYTES = 40 * 1024 * 1024

export type InsurerNewsFileKind = 'image' | 'pdf'

export interface ValidateInsurerNewsFileResult {
  ok: true
  kind: InsurerNewsFileKind
}

export interface ValidateInsurerNewsFileError {
  ok: false
  message: string
}

export function validateInsurerNewsFile(file: File): ValidateInsurerNewsFileResult | ValidateInsurerNewsFileError {
  const type = file.type || ''
  if (IMAGE_TYPES.has(type)) {
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, message: '이미지는 15MB 이하만 업로드할 수 있습니다.' }
    }
    return { ok: true, kind: 'image' }
  }
  if (PDF_TYPES.has(type)) {
    if (file.size > MAX_PDF_BYTES) {
      return { ok: false, message: 'PDF는 40MB 이하만 업로드할 수 있습니다.' }
    }
    return { ok: true, kind: 'pdf' }
  }
  return {
    ok: false,
    message: 'JPG, PNG, WEBP, GIF 이미지 또는 PDF만 업로드할 수 있습니다.',
  }
}
