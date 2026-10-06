import { createScenarioId } from './ids'
import { createScenarioFromTemplate } from './templates'
import type { DiseaseType } from './types'
import type { ScenarioTemplate } from './templateTypes'

/** Canonical seed identity — metadata only, not immutability. */
export const SEED_SCENARIO_KEYS: Record<Exclude<DiseaseType, 'custom'>, string> = {
  cancer: 'seed:cancer',
  cerebrovascular: 'seed:cerebrovascular',
  heart: 'seed:heart',
  'care-dementia': 'seed:care-dementia',
  'fracture-surgery': 'seed:fracture-surgery',
}

export const SEED_DISEASE_ORDER: DiseaseType[] = [
  'cancer',
  'cerebrovascular',
  'heart',
  'care-dementia',
  'fracture-surgery',
  'custom',
]

export function seedKeyForDiseaseType(diseaseType: DiseaseType): string {
  return diseaseType === 'custom' ? 'seed:custom' : SEED_SCENARIO_KEYS[diseaseType]
}

export function buildSeedScenarioTemplate(diseaseType: DiseaseType): ScenarioTemplate | null {
  const scenario = createScenarioFromTemplate(diseaseType)
  if (!scenario) return null
  const now = scenario.createdAt
  return {
    id: createScenarioId(),
    name: scenario.title,
    description: scenario.description,
    sourceType: 'user',
    seedKey: seedKeyForDiseaseType(diseaseType),
    systemDiseaseType: diseaseType,
    items: scenario.items,
    createdAt: now,
    updatedAt: scenario.updatedAt,
  }
}

export function buildInitialSeedScenarioTemplates(): ScenarioTemplate[] {
  return SEED_DISEASE_ORDER.map((diseaseType) => buildSeedScenarioTemplate(diseaseType)).filter(
    (row): row is ScenarioTemplate => row !== null,
  )
}

export function scenarioTemplateSortIndex(template: ScenarioTemplate): number {
  if (!template.seedKey) return 100
  const idx = SEED_DISEASE_ORDER.findIndex((d) => seedKeyForDiseaseType(d) === template.seedKey)
  return idx >= 0 ? idx : 99
}

export function compareScenarioTemplates(a: ScenarioTemplate, b: ScenarioTemplate): number {
  const diff = scenarioTemplateSortIndex(a) - scenarioTemplateSortIndex(b)
  if (diff !== 0) return diff
  return a.name.localeCompare(b.name, 'ko')
}
