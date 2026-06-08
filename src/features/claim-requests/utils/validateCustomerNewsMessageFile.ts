const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const FILE_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
])

const MAX_BYTES = 25 * 1024 * 1024

export type CustomerNewsMessageFileKind = 'image' | 'file'

export interface ValidateCustomerNewsMessageFileOk {
  ok: true
  kind: CustomerNewsMessageFileKind
}

export interface ValidateCustomerNewsMessageFileError {
  ok: false
  message: string
}

export function validateCustomerNewsMessageFile(
  file: File,
): ValidateCustomerNewsMessageFileOk | ValidateCustomerNewsMessageFileError {
  const type = file.type || ''
  if (IMAGE_MIME.has(type)) {
    if (file.size > MAX_BYTES) {
      return { ok: false, message: '첨부파일은 25MB 이하만 업로드할 수 있습니다.' }
    }
    return { ok: true, kind: 'image' }
  }
  if (FILE_MIME.has(type)) {
    if (file.size > MAX_BYTES) {
      return { ok: false, message: '첨부파일은 25MB 이하만 업로드할 수 있습니다.' }
    }
    return { ok: true, kind: 'file' }
  }
  return {
    ok: false,
    message: 'JPG, PNG, PDF, XLS, XLSX, CSV 파일만 첨부할 수 있습니다.',
  }
}
