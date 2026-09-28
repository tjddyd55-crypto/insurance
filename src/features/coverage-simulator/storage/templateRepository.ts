import { cloneUserTemplate } from '../domain/templateOperations'
import type { ScenarioTemplate, ScenarioTemplateSummary } from '../domain/templateTypes'
import { isPreviewUserKey } from './previewStorageKeys'
import {
  deleteLocalUserTemplate,
  getLocalUserTemplateById,
  listLocalUserTemplates,
  saveLocalUserTemplate,
} from './localTemplateRepository'
import {
  deleteCrmUserTemplate,
  duplicateCrmUserTemplate,
  getCrmUserTemplateById,
  isCrmCoverageStorageReady,
  listCrmUserTemplates,
  saveCrmUserTemplate,
} from './crmCoverageStorageSession'

export function listUserTemplates(userKey: string): ScenarioTemplateSummary[] {
  if (isPreviewUserKey(userKey)) {
    return listLocalUserTemplates(userKey)
  }
  if (!isCrmCoverageStorageReady(userKey)) return []
  return listCrmUserTemplates().map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    sourceType: template.sourceType,
    itemCount: template.items.length,
    updatedAt: template.updatedAt,
  }))
}

export function getUserTemplateById(userKey: string, id: string): ScenarioTemplate | null {
  if (isPreviewUserKey(userKey)) {
    return getLocalUserTemplateById(userKey, id)
  }
  if (!isCrmCoverageStorageReady(userKey)) return null
  return getCrmUserTemplateById(id)
}

export function saveUserTemplate(userKey: string, template: ScenarioTemplate): ScenarioTemplate {
  if (isPreviewUserKey(userKey)) {
    return saveLocalUserTemplate(userKey, template)
  }
  throw new Error('CRM 시나리오 저장은 saveUserTemplateAsync를 사용하세요.')
}

export async function saveUserTemplateAsync(
  userKey: string,
  template: ScenarioTemplate,
): Promise<ScenarioTemplate> {
  if (isPreviewUserKey(userKey)) {
    return saveLocalUserTemplate(userKey, template)
  }
  return saveCrmUserTemplate(template)
}

export function deleteUserTemplate(userKey: string, id: string): void {
  if (isPreviewUserKey(userKey)) {
    deleteLocalUserTemplate(userKey, id)
    return
  }
  throw new Error('CRM 시나리오 삭제는 deleteUserTemplateAsync를 사용하세요.')
}

export async function deleteUserTemplateAsync(userKey: string, id: string): Promise<void> {
  if (isPreviewUserKey(userKey)) {
    deleteLocalUserTemplate(userKey, id)
    return
  }
  await deleteCrmUserTemplate(id)
}

export async function duplicateUserTemplateAsync(userKey: string, id: string): Promise<ScenarioTemplate> {
  if (isPreviewUserKey(userKey)) {
    const source = getLocalUserTemplateById(userKey, id)
    if (!source) throw new Error('시나리오를 찾을 수 없습니다.')
    return saveLocalUserTemplate(userKey, cloneUserTemplate(source))
  }
  return duplicateCrmUserTemplate(id)
}
