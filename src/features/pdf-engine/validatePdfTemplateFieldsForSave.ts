import type { PdfFieldSpec } from './types'

/**
 * 관리자 PDF 템플릿 "필드/좌표 저장" 직전 검증.
 * 서버 `normalizeFieldSpec` 와 맞추되, 라디오 옵션 중복·빈 라벨 등 UX 상 먼저 막을 항목을 둔다.
 */
export function validatePdfTemplateFieldsForSave(fields: PdfFieldSpec[]): string | null {
  for (const f of fields) {
    if (f.fieldType !== 'radio') continue
    const opts = f.options ?? []
    if (opts.length === 0) {
      return `라디오 필드 "${f.label}" 은 옵션을 최소 1개 이상 추가해야 저장할 수 있습니다.`
    }
    const seen = new Set<string>()
    for (const raw of opts) {
      const t = String(raw ?? '').trim()
      if (!t) {
        return `라디오 필드 "${f.label}" 에 빈 옵션 라벨이 있습니다. 옵션 이름을 입력하거나 삭제해 주세요.`
      }
      if (seen.has(t)) {
        return `라디오 필드 "${f.label}" 에 중복된 옵션 "${t}" 이(가) 있습니다.`
      }
      seen.add(t)
    }
  }
  return null
}
