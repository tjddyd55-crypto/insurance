import { createScenarioId } from '../domain/ids'
import {
  buildInitialSeedScenarioTemplates,
  compareScenarioTemplates,
  seedKeyForDiseaseType,
} from '../domain/scenarioSeed'
import { buildSystemTemplateSnapshot } from '../domain/systemTemplateCatalog'
import type { DiseaseType } from '../domain/types'
import type { ScenarioTemplate, ScenarioTemplateSummary } from '../domain/templateTypes'
import { isPreviewUserKey, scenarioLibraryInitStorageKey, templateStorageKey } from './previewStorageKeys'
import {
  scenarioItemsMatch,
  systemTemplateIdForStoredTemplateId,
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
  return {
    ...raw,
    sourceType: raw.sourceType === 'system' ? 'user' : raw.sourceType,
  }
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

/** One-time seed bootstrap — deleted seeds are not recreated on later visits. */
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
  ensureScenarioLibraryBootstrap(userKey)
  return readRaw(userKey)
}

function writeAll(userKey: string, templates: ScenarioTemplate[]): void {
  writeRaw(userKey, templates)
}

function crmSystemTemplates(): ScenarioTemplate[] {
  const diseaseTypes: DiseaseType[] = [
    'cancer',
    'cerebrovascular',
    'heart',
    'care-dementia',
    'fracture-surgery',
    'custom',
  ]
  const rows: ScenarioTemplate[] = []
  for (const diseaseType of diseaseTypes) {
    const snapshot = buildSystemTemplateSnapshot(diseaseType)
    if (!snapshot) continue
    rows.push({ ...snapshot, seedKey: seedKeyForDiseaseType(diseaseType) })
  }
  return rows
}

function systemTemplateById(id: string): ScenarioTemplate | null {
  return crmSystemTemplates().find((row) => row.id === id) ?? null
}

/** 서버에 올라간 시드 사본이면 같은 시스템 카드를 다시 보여 주지 않는다. */
export function coveredSystemTemplateId(template: ScenarioTemplate): string | null {
  if (template.legacyClientId) {
    const tagged = systemTemplateIdForStoredTemplateId(template.legacyClientId)
    if (tagged) return tagged
  }
  const disease = template.systemDiseaseType
  if (!disease) return null
  const system = systemTemplateById(`system:${disease}`)
  if (!system) return null
  if (template.name !== system.name) return null
  if (!scenarioItemsMatch(template.items, system.items)) return null
  return system.id
}

function localSeedAliasIds(userKey: string, diseaseType: DiseaseType): string[] {
  const seedKey = seedKeyForDiseaseType(diseaseType)
  return readRaw(userKey)
    .filter((row) => row.seedKey === seedKey)
    .map((row) => row.id)
}

function mergeCrmScenarioTemplates(serverTemplates: ScenarioTemplate[]): ScenarioTemplate[] {
  const covered = new Set(
    serverTemplates
      .map((row) => coveredSystemTemplateId(row))
      .filter((id): id is string => Boolean(id)),
  )
  const systems = crmSystemTemplates().filter((row) => !covered.has(row.id))
  return [...systems, ...serverTemplates].sort(compareScenarioTemplates)
}

export function listScenarioTemplates(userKey: string): ScenarioTemplateSummary[] {
  if (usesServerTemplates(userKey)) {
    return mergeCrmScenarioTemplates(listCrmUserTemplates()).map(toSummary)
  }
  return readAll(userKey).slice().sort(compareScenarioTemplates).map(toSummary)
}

/** @deprecated use listScenarioTemplates */
export function listUserTemplates(userKey: string): ScenarioTemplateSummary[] {
  return listScenarioTemplates(userKey)
}

function localSeedSystemId(userKey: string, id: string): string | null {
  const local = readRaw(userKey).find((row) => row.id === id && row.seedKey)
  if (!local?.systemDiseaseType && !local?.seedKey) return null
  const disease =
    local.systemDiseaseType ??
    (local.seedKey?.startsWith('seed:') ? (local.seedKey.slice('seed:'.length) as DiseaseType) : null)
  if (!disease) return null
  return systemTemplateById(`system:${disease}`)?.id ?? null
}

export function getScenarioTemplateById(userKey: string, id: string): ScenarioTemplate | null {
  if (usesServerTemplates(userKey)) {
    const serverTemplates = listCrmUserTemplates()
    const serverHit =
      getCrmUserTemplateById(id) ?? serverTemplates.find((row) => row.legacyClientId === id) ?? null
    if (serverHit) return serverHit
    const systemId = systemTemplateIdForStoredTemplateId(id) ?? localSeedSystemId(userKey, id)
    if (!systemId) return null
    const covering = serverTemplates.find(
      (row) => coveredSystemTemplateId(row) === systemId || row.legacyClientId === id,
    )
    if (covering) return covering
    return systemTemplateById(systemId)
  }
  return readAll(userKey).find((row) => row.id === id) ?? null
}

export function resolveTemplateMatchIdentity(userKey: string, templateId: string): TemplateMatchIdentity {
  const template = getScenarioTemplateById(userKey, templateId)
  const systemCatalogId = template
    ? template.id.startsWith('system:')
      ? template.id
      : coveredSystemTemplateId(template)
    : systemTemplateIdForStoredTemplateId(templateId)
  const disease = systemCatalogId?.startsWith('system:')
    ? (systemCatalogId.slice('system:'.length) as DiseaseType)
    : template?.systemDiseaseType
  const system = systemCatalogId ? systemTemplateById(systemCatalogId) : null
  const aliasIds = new Set<string>()
  if (systemCatalogId && disease) {
    aliasIds.add(systemCatalogId)
    aliasIds.add(`seed:${disease}`)
    for (const localId of localSeedAliasIds(userKey, disease)) aliasIds.add(localId)
  }
  if (template?.id) aliasIds.delete(template.id)
  if (template?.legacyClientId) aliasIds.delete(template.legacyClientId)
  return {
    id: template?.id ?? templateId,
    legacyClientId: template?.legacyClientId ?? null,
    aliasIds: [...aliasIds],
    systemCatalogId,
    name: system?.name ?? template?.name,
    systemDiseaseType: disease,
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
  if (usesServerTemplates(userKey)) {
    if (template.id.startsWith('system:') || template.sourceType === 'system') {
      const forked: ScenarioTemplate = {
        ...template,
        id: createScenarioId(),
        sourceType: 'user',
        seedKey: undefined,
        legacyClientId: null,
      }
      return saveCrmUserTemplate(forked)
    }
    return saveCrmUserTemplate(template)
  }
  return saveScenarioTemplate(userKey, template)
}

export async function removeScenarioTemplate(userKey: string, id: string): Promise<void> {
  if (usesServerTemplates(userKey)) {
    const resolved = getScenarioTemplateById(userKey, id)
    if (!resolved || resolved.id.startsWith('system:') || resolved.sourceType === 'system') return
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
