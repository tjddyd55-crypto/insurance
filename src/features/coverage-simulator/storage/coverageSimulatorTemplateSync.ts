import { buildSeedScenarioTemplate, SEED_DISEASE_ORDER } from '../domain/scenarioSeed'
import type { DiseaseType, ScenarioItem } from '../domain/types'
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

export function scenarioItemsMatch(left: readonly ScenarioItem[], right: readonly ScenarioItem[]): boolean {
  if (left.length !== right.length) return false
  return left.every((item, index) => itemContentKey(item) === itemContentKey(right[index]))
}

function diseaseFromTaggedId(id: string, prefix: string): DiseaseType | null {
  if (!id.startsWith(prefix)) return null
  const disease = id.slice(prefix.length)
  return (SEED_DISEASE_ORDER as readonly string[]).includes(disease) ? (disease as DiseaseType) : null
}

/** `system:<disease>` 와 예전 `seed:<disease>` id 를 시스템 카탈로그 id 로 맞춘다. */
export function systemTemplateIdForStoredTemplateId(storedId: string): string | null {
  const systemDisease = diseaseFromTaggedId(storedId, 'system:')
  if (systemDisease) return `system:${systemDisease}`
  const seedDisease = diseaseFromTaggedId(storedId, 'seed:')
  if (seedDisease) return `system:${seedDisease}`
  return null
}

export type TemplateMatchIdentity = {
  id: string
  legacyClientId?: string | null
  /** 로컬 시드 uuid, `seed:*` 같이 이 시나리오가 대신 받는 id */
  aliasIds?: readonly string[]
  /** 이 행이 대표하는 시스템 카탈로그 id. 없으면 시스템 매칭을 하지 않는다. */
  systemCatalogId?: string | null
  name?: string
  systemDiseaseType?: DiseaseType
}

export type SimulationTemplateMatch = {
  diseaseType?: string
  templateNameSnapshot?: string | null
  /** 다른 서버 템플릿 id 또는 legacyClientId 에 이미 연결된 경우 */
  claimedByOtherTemplate?: boolean
}

/**
 * 서버 숫자 id, 마이그레이션 전 로컬 id, 시스템 카탈로그 id, 예전 시드 id 를
 * 같은 시나리오로 본다. 시스템 템플릿은 서버에 올리지 않는다.
 */
export function simulationBelongsToTemplate(
  template: TemplateMatchIdentity,
  simulationTemplateId: string | null | undefined,
  simulation?: SimulationTemplateMatch,
): boolean {
  if (!simulationTemplateId) return false
  if (simulationTemplateId === template.id) return true
  if (template.legacyClientId && simulationTemplateId === template.legacyClientId) return true
  if (template.aliasIds?.includes(simulationTemplateId)) return true
  const mapped = systemTemplateIdForStoredTemplateId(simulationTemplateId)
  if (mapped && (mapped === template.id || mapped === template.systemCatalogId)) return true
  if (
    simulation &&
    template.systemCatalogId &&
    !simulation.claimedByOtherTemplate &&
    simulation.diseaseType &&
    simulation.diseaseType === diseaseFromTaggedId(template.systemCatalogId, 'system:') &&
    simulation.templateNameSnapshot &&
    simulation.templateNameSnapshot === template.name
  ) {
    return true
  }
  return false
}
