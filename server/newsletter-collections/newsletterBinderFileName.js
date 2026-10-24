/**
 * 소식지 → 바인더 PDF 저장용 파일명 정규화 (소식지 저장 경로 전용).
 * 제목의 연속/끝 점(`..`, `...`)이 storage key에 들어가면 key 후보 검증(`..` 차단)에 걸리므로
 * 업로드 파일명을 안전하게 만든다. storage key 검증 규칙 자체는 변경하지 않는다.
 */
const NEWSLETTER_PDF_FALLBACK_NAME = '소식지'

/**
 * @param {unknown} titleRaw
 * @returns {string} 정확히 한 번 `.pdf`로 끝나는 파일명
 */
export function buildNewsletterBinderPdfFileName(titleRaw) {
  let base = String(titleRaw ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .trim()
  base = base.replace(/(\.pdf)+$/i, '')
  base = base
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
  if (!base) {
    base = NEWSLETTER_PDF_FALLBACK_NAME
  }
  return `${base}.pdf`
}
