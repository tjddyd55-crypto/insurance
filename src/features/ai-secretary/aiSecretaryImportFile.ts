import { CUSTOMER_IMPORT_ALLOWED_EXTENSIONS, CUSTOMER_IMPORT_FILE_LIMITS } from '../../../shared/ai-assistant/customer-import/constants.js'

export function validateAiImportAttachmentFile(file: File): string | null {
  const name = file.name.trim().toLowerCase()
  let allowed = false
  for (const ext of CUSTOMER_IMPORT_ALLOWED_EXTENSIONS) {
    if (name.endsWith(ext)) {
      allowed = true
      break
    }
  }
  if (!allowed) {
    return '현재 이 파일 형식은 아직 지원하지 않습니다.'
  }
  if (file.size > CUSTOMER_IMPORT_FILE_LIMITS.maxBytes) {
    return '파일 크기가 허용 범위를 초과했습니다.'
  }
  return null
}
