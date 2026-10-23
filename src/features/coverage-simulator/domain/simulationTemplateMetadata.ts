/** 템플릿 조회가 실패했을 때의 표시. 이름 스냅샷으로 옛 템플릿을 되찾지 않는다. */
export function simulationTemplateMetadataLabel(
  templateId: string | null | undefined,
  resolvedTemplateName: string | null | undefined,
): string {
  if (!templateId) return '템플릿 없음'
  const name = resolvedTemplateName?.trim()
  if (!name) return '기존 템플릿'
  return name
}
