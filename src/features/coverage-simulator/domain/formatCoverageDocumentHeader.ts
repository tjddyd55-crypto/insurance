/** 제목 바로 아래 줄. 고객이 없으면 작성일만 남긴다. */
export function formatCoverageDocumentMetaLine(
  customerName: string | null | undefined,
  wroteLabel: string | null | undefined,
): string {
  const name = customerName?.trim() ?? ''
  const date = wroteLabel?.trim() ?? ''
  if (name && date) return `고객: ${name} · 작성일 ${date}`
  if (name) return `고객: ${name}`
  if (date) return `작성일 ${date}`
  return ''
}
