import type { CoverageScenario } from './types'

export function resolveCoverageSimulationListPath(basePath: string, templateId: string): string {
  const id = templateId.trim()
  return `${basePath}/templates/${id}/simulations`
}

/**
 * 모바일 CRM·preview-mobile 편집기 뒤로가기 SSOT.
 * - 템플릿 편집 → 시나리오 라이브러리(index)
 * - templateId가 있는 상담 → 해당 시나리오의 시뮬레이션 목록
 * - 레거시 disease 상담 → disease 목록
 */
export function resolveCoverageEditorBackPath(
  basePath: string,
  scenario: Pick<CoverageScenario, 'templateId' | 'diseaseType'>,
  options?: { isTemplateEditor?: boolean },
): string {
  if (options?.isTemplateEditor) {
    return basePath
  }
  const templateId = scenario.templateId?.trim()
  if (templateId) {
    return resolveCoverageSimulationListPath(basePath, templateId)
  }
  return `${basePath}/${scenario.diseaseType}`
}
