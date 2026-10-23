import { formatConsultationListDate } from './formatConsultationDate'

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

export function simulationListPrimaryLabel(title: string | null | undefined): string {
  const trimmed = title?.trim()
  return trimmed || '제목 없음'
}

/** 단독 목록은 고객 이름(없으면 미연결)을 보조 줄에 둔다. 고객 탭은 제목 아래 수정일만 유지한다. */
export function simulationListSecondaryLabel(input: {
  customerName?: string | null
  updatedAt: string
  templateLabel: string
  customerScoped: boolean
}): string {
  const date = formatConsultationListDate(input.updatedAt)
  if (input.customerScoped) {
    return `수정 ${date} · ${input.templateLabel}`
  }
  const customer = input.customerName?.trim() || '미연결'
  return `${customer} · ${date} · ${input.templateLabel}`
}
