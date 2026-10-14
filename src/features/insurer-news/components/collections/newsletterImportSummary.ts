import type { NewsletterBinderImportResponse } from '../../services/newsletterCollections.service'

/** 일괄 가져오기 결과를 항목별로 요약한다 (실패·경고를 숨기지 않는다). */
export function summarizeNewsletterImport(response: NewsletterBinderImportResponse, target: string) {
  const lines: string[] = []
  const already = response.results.filter((r) => r.ok && r.existing).length
  const added = response.succeeded - already
  if (added > 0) lines.push(`${added}개를 ${target.trim()}에 담았습니다.`)
  if (already > 0) lines.push(`${already}개는 이미 이 섹션에 있습니다.`)
  for (const r of response.results) {
    if (!r.ok) lines.push(`실패: ${r.message ?? '알 수 없는 오류'}`)
    for (const w of r.warnings ?? []) lines.push(`참고: ${w}`)
  }
  return lines.join('\n')
}
