import { createCoverageTemplateApi } from './coverageSimulatorStorage.api'
import { shouldUploadLegacyTemplate } from './coverageSimulatorTemplateSync'
import { templateStorageKey } from './previewStorageKeys'
import type { ScenarioTemplate } from '../domain/templateTypes'

function readCrmLocalTemplates(userKey: string): ScenarioTemplate[] {
  const key = templateStorageKey(userKey)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ScenarioTemplate[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * CRM 시나리오 템플릿은 브라우저 localStorage 에만 있으면 다른 PC 에서 목록이 비어
 * 그 템플릿 id 로 저장된 서버 시뮬레이션도 안 보인다.
 * 기존 templates API(legacyClientId)로 한 번 올리고, 스키마는 바꾸지 않는다.
 */
export async function importLegacyLocalTemplates(
  token: string,
  userKey: string,
  existingLegacyIds: Set<string>,
): Promise<void> {
  if (!userKey || userKey === 'guest') return
  const locals = readCrmLocalTemplates(userKey)
  for (const template of locals) {
    if (existingLegacyIds.has(template.id)) continue
    if (!shouldUploadLegacyTemplate(template)) continue
    await createCoverageTemplateApi(token, {
      name: template.name,
      description: template.description,
      diseaseType: template.systemDiseaseType ?? 'custom',
      items: template.items,
      legacyClientId: template.id,
    })
    existingLegacyIds.add(template.id)
  }
}
