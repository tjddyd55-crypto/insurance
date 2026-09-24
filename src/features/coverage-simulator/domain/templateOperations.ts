import { createScenarioId } from './ids'
import type { ConsultationCustomerDraft } from './customerContext'
import { emptyCustomerDraft } from './customerContext'
import type { CoverageScenario, DiseaseType, ScenarioItem } from './types'
import type { ScenarioTemplate } from './templateTypes'

export function cloneScenarioItems(items: ScenarioItem[]): ScenarioItem[] {
  return items.map((item) => {
    if (item.type === 'time-marker') {
      return { ...item, id: createScenarioId() }
    }
    return { ...item, id: createScenarioId() }
  })
}

export function createEmptyUserTemplate(name: string, description?: string): ScenarioTemplate {
  const now = new Date().toISOString()
  return {
    id: createScenarioId(),
    name: name.trim() || '새 시나리오',
    description: description?.trim() || undefined,
    sourceType: 'user',
    items: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function cloneUserTemplate(
  source: ScenarioTemplate,
  overrides?: { name?: string; description?: string },
): ScenarioTemplate {
  const now = new Date().toISOString()
  return {
    id: createScenarioId(),
    name: overrides?.name?.trim() || `${source.name} (복사)`,
    description: overrides?.description ?? source.description,
    sourceType: 'user',
    category: source.category,
    items: cloneScenarioItems(source.items),
    createdAt: now,
    updatedAt: now,
  }
}

export function createConsultationFromTemplate(
  template: Pick<ScenarioTemplate, 'id' | 'name' | 'items'>,
  options?: {
    diseaseType?: DiseaseType
    description?: string
    customer?: ConsultationCustomerDraft | null
  },
): CoverageScenario {
  const now = new Date().toISOString()
  const customer = options?.customer ?? emptyCustomerDraft()
  const snapshot = customer.customerNameSnapshot
  return {
    id: createScenarioId(),
    kind: 'consultation',
    title: template.name,
    diseaseType: options?.diseaseType ?? 'custom',
    description: options?.description ?? '',
    customerId: customer.customerId,
    customerNameSnapshot: snapshot,
    customerName: snapshot ?? undefined,
    consultationDate: now.slice(0, 10),
    items: cloneScenarioItems(template.items),
    templateId: template.id,
    templateNameSnapshot: template.name,
    createdAt: now,
    updatedAt: now,
  }
}

export function templateToEditableScenario(template: ScenarioTemplate): CoverageScenario {
  return {
    id: template.id,
    title: template.name,
    diseaseType: template.systemDiseaseType ?? 'custom',
    description: template.description ?? '',
    consultationDate: template.updatedAt.slice(0, 10),
    items: template.items,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }
}

export function scenarioToUserTemplate(
  scenario: CoverageScenario,
  existing?: ScenarioTemplate,
): ScenarioTemplate {
  const now = new Date().toISOString()
  return {
    id: existing?.id ?? scenario.id,
    name: scenario.title,
    description: scenario.description || existing?.description,
    sourceType: 'user',
    category: existing?.category,
    items: scenario.items,
    createdAt: existing?.createdAt ?? scenario.createdAt ?? now,
    updatedAt: now,
  }
}
