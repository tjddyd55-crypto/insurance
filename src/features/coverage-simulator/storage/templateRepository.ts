import {
  buildInitialSeedScenarioTemplates,
  compareScenarioTemplates,
} from '../domain/scenarioSeed'
import type { ScenarioTemplate, ScenarioTemplateSummary } from '../domain/templateTypes'
import { isPreviewUserKey, scenarioLibraryInitStorageKey, templateStorageKey } from './previewStorageKeys'
import {
  isSystemDefaultTemplate,
  type TemplateMatchIdentity,
} from './coverageSimulatorTemplateSync'
import {
  deleteCrmUserTemplate,
  duplicateCrmUserTemplate,
  getCrmUserTemplateById,
  isCrmCoverageStorageReady,
  listCrmUserTemplates,
  saveCrmUserTemplate,
} from './crmCoverageStorageSession'

function usesServerTemplates(userKey: string): boolean {
  return !isPreviewUserKey(userKey) && isCrmCoverageStorageReady(userKey)
}

function toSummary(template: ScenarioTemplate): ScenarioTemplateSummary {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    sourceType: template.sourceType,
    seedKey: template.seedKey,
    itemCount: template.items.length,
    updatedAt: template.updatedAt,
  }
}

function normalizeTemplate(raw: ScenarioTemplate): ScenarioTemplate {
  return { ...raw }
}

function visibleUserTemplates(rows: ScenarioTemplate[]): ScenarioTemplate[] {
  return rows.filter((row) => !isSystemDefaultTemplate(row))
}

function readRaw(userKey: string): ScenarioTemplate[] {
  const key = templateStorageKey(userKey)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ScenarioTemplate[]
    return Array.isArray(parsed) ? parsed.map(normalizeTemplate) : []
  } catch {
    return []
  }
}

function writeRaw(userKey: string, templates: ScenarioTemplate[]): void {
  const key = templateStorageKey(userKey)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(templates))
}

/**
 * 예전 미리보기 시드 삽입. 템플릿 목록·신규 시뮬레이션 경로에서는 호출하지 않는다.
 * 시스템 기본 템플릿은 UI에 넣지 않고 서버로도 올리지 않는다.
 */
export function ensureScenarioLibraryBootstrap(userKey: string): void {
  const initKey = scenarioLibraryInitStorageKey(userKey)
  const storageKey = templateStorageKey(userKey)
  if (!initKey || !storageKey) return
  if (localStorage.getItem(initKey)) return

  const existing = readRaw(userKey)
  if (existing.length === 0) {
    writeRaw(userKey, buildInitialSeedScenarioTemplates())
  }
  localStorage.setItem(initKey, new Date().toISOString())
}

function readAll(userKey: string): ScenarioTemplate[] {
  return readRaw(userKey)
}

function writeAll(userKey: string, templates: ScenarioTemplate[]): void {
  writeRaw(userKey, templates)
}

export function listScenarioTemplates(userKey: string): ScenarioTemplateSummary[] {
  if (usesServerTemplates(userKey)) {
    return visibleUserTemplates(listCrmUserTemplates()).map(toSummary)
  }
  return visibleUserTemplates(readRaw(userKey)).slice().sort(compareScenarioTemplates).map(toSummary)
}

/** @deprecated use listScenarioTemplates */
export function listUserTemplates(userKey: string): ScenarioTemplateSummary[] {
  return listScenarioTemplates(userKey)
}

export function getScenarioTemplateById(userKey: string, id: string): ScenarioTemplate | null {
  if (usesServerTemplates(userKey)) {
    const serverTemplates = listCrmUserTemplates()
    const serverHit =
      getCrmUserTemplateById(id) ?? serverTemplates.find((row) => row.legacyClientId === id) ?? null
    if (!serverHit || isSystemDefaultTemplate(serverHit)) return null
    return serverHit
  }
  const local = readRaw(userKey).find((row) => row.id === id) ?? null
  if (!local || isSystemDefaultTemplate(local)) return null
  return local
}

export function resolveTemplateMatchIdentity(userKey: string, templateId: string): TemplateMatchIdentity {
  const template = getScenarioTemplateById(userKey, templateId)
  return {
    id: template?.id ?? templateId,
    legacyClientId: template?.legacyClientId ?? null,
  }
}

/** @deprecated use getScenarioTemplateById */
export function getUserTemplateById(userKey: string, id: string): ScenarioTemplate | null {
  return getScenarioTemplateById(userKey, id)
}

export function saveScenarioTemplate(userKey: string, template: ScenarioTemplate): ScenarioTemplate {
  const next: ScenarioTemplate = {
    ...template,
    sourceType: 'user',
    updatedAt: new Date().toISOString(),
  }
  const all = readAll(userKey)
  const index = all.findIndex((row) => row.id === next.id)
  if (index >= 0) {
    all[index] = next
  } else {
    all.unshift(next)
  }
  writeAll(userKey, all)
  return next
}

/** @deprecated use saveScenarioTemplate */
export function saveUserTemplate(userKey: string, template: ScenarioTemplate): ScenarioTemplate {
  return saveScenarioTemplate(userKey, template)
}

export async function persistScenarioTemplate(
  userKey: string,
  template: ScenarioTemplate,
): Promise<ScenarioTemplate> {
  if (isSystemDefaultTemplate(template)) {
    return template
  }
  if (usesServerTemplates(userKey)) {
    return saveCrmUserTemplate({ ...template, sourceType: 'user' })
  }
  return saveScenarioTemplate(userKey, template)
}

export async function removeScenarioTemplate(userKey: string, id: string): Promise<void> {
  if (isSystemDefaultTemplate({ id, sourceType: 'user' })) return
  if (usesServerTemplates(userKey)) {
    const resolved = getScenarioTemplateById(userKey, id)
    if (!resolved) return
    await deleteCrmUserTemplate(resolved.id)
    return
  }
  deleteScenarioTemplate(userKey, id)
}

export async function copyScenarioTemplate(
  userKey: string,
  source: ScenarioTemplate,
  copy: ScenarioTemplate,
): Promise<ScenarioTemplate> {
  if (usesServerTemplates(userKey) && /^\d+$/.test(source.id)) {
    return duplicateCrmUserTemplate(source.id)
  }
  return persistScenarioTemplate(userKey, copy)
}

export function deleteScenarioTemplate(userKey: string, id: string): void {
  writeAll(
    userKey,
    readAll(userKey).filter((row) => row.id !== id),
  )
}

/** @deprecated use deleteScenarioTemplate */
export function deleteUserTemplate(userKey: string, id: string): void {
  deleteScenarioTemplate(userKey, id)
}
