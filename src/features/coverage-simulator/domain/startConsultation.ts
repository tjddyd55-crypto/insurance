import { createConsultationFromTemplate } from './templateOperations'
import { buildSystemTemplateSnapshot } from './systemTemplateCatalog'
import type { DiseaseType } from './types'
import type { ScenarioTemplate } from './templateTypes'
import { saveConsultation } from '../storage/consultationRepository'
import type { CoverageScenario } from './types'

export function startConsultationFromUserTemplate(
  userKey: string,
  template: ScenarioTemplate,
): CoverageScenario {
  const consultation = createConsultationFromTemplate(template, { diseaseType: 'custom' })
  return saveConsultation(userKey, consultation)
}

export function startConsultationFromSystemDisease(
  userKey: string,
  diseaseType: DiseaseType,
): CoverageScenario | null {
  const system = buildSystemTemplateSnapshot(diseaseType)
  if (!system) return null
  const consultation = createConsultationFromTemplate(system, {
    diseaseType,
    description: system.description ?? '',
  })
  return saveConsultation(userKey, consultation)
}
