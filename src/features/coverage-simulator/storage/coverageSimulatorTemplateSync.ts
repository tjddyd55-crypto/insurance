import type { ScenarioTemplate } from '../domain/templateTypes'

/**
 * 시스템 기본(시드) 템플릿 판별. id / seedKey / sourceType 만 사용한다.
 * 이름·항목 내용으로 옛 id 를 맞추지 않는다.
 */
export function isSystemDefaultTemplate(
  template: Pick<ScenarioTemplate, 'id' | 'sourceType'> & { seedKey?: string | null },
): boolean {
  if (template.sourceType === 'system') return true
  if (template.id.startsWith('system:') || template.id.startsWith('seed:')) return true
  if (template.seedKey?.startsWith('seed:')) return true
  return false
}

/** 사용자가 만든 로컬 템플릿만 서버로 올린다. 시스템 기본값은 참조 여부와 무관하게 올리지 않는다. */
export function shouldUploadLegacyTemplate(template: ScenarioTemplate): boolean {
  return !isSystemDefaultTemplate(template)
}

export type TemplateMatchIdentity = {
  id: string
  legacyClientId?: string | null
}

/** 서버 id 또는 마이그레이션 전 legacyClientId 만 같은 템플릿으로 본다. */
export function simulationBelongsToTemplate(
  template: TemplateMatchIdentity,
  simulationTemplateId: string | null | undefined,
): boolean {
  if (!simulationTemplateId) return false
  if (simulationTemplateId === template.id) return true
  if (template.legacyClientId && simulationTemplateId === template.legacyClientId) return true
  return false
}
