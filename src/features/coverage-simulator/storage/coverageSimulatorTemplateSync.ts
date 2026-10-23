import { buildSeedScenarioTemplate } from '../domain/scenarioSeed'
import type { ScenarioItem } from '../domain/types'
import type { ScenarioTemplate } from '../domain/templateTypes'

function itemContentKey(item: ScenarioItem): string {
  if (item.type === 'time-marker') {
    return `time:${item.label}`
  }
  return `coverage:${item.label}:${item.currentAmount ?? ''}:${item.proposedAmount ?? ''}`
}

/** 부트스트랩 시드 원본과 이름·항목 내용이 같으면 다른 PC 로 올릴 필요가 없다. */
export function isPristineSeedTemplate(template: ScenarioTemplate): boolean {
  if (!template.seedKey) return false
  const fresh = buildSeedScenarioTemplate(template.systemDiseaseType ?? 'custom')
  if (!fresh || fresh.name !== template.name) return false
  if (fresh.items.length !== template.items.length) return false
  return fresh.items.every((item, index) => itemContentKey(item) === itemContentKey(template.items[index]))
}

/**
 * 로컬 템플릿을 서버로 올릴지.
 * 손대지 않은 시드는, 이미 저장된 시뮬레이션이 그 id 를 가리킬 때만 올린다.
 */
export function shouldUploadLegacyTemplate(
  template: ScenarioTemplate,
  referencedTemplateIds: ReadonlySet<string>,
): boolean {
  if (isPristineSeedTemplate(template) && !referencedTemplateIds.has(template.id)) {
    return false
  }
  return true
}

/** 서버 숫자 id 와 마이그레이션 전 로컬 id 를 같은 시나리오로 본다. */
export function simulationBelongsToTemplate(
  template: { id: string; legacyClientId?: string | null },
  simulationTemplateId: string | null | undefined,
): boolean {
  if (!simulationTemplateId) return false
  if (simulationTemplateId === template.id) return true
  return Boolean(template.legacyClientId) && simulationTemplateId === template.legacyClientId
}
