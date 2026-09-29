import {
  buildInitialSeedScenarioTemplates,
  compareScenarioTemplates,
} from '../domain/scenarioSeed'
import type { ScenarioTemplate, ScenarioTemplateSummary } from '../domain/templateTypes'
import {
  scenarioLibraryInitStorageKey,
  templateStorageKey,
} from './previewStorageKeys'

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

export function listScenarioTemplates(userKey: string): ScenarioTemplateSummary[] {
  return readAll(userKey)
    .slice()
    .sort(compareScenarioTemplates)
    .map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      sourceType: template.sourceType,
      seedKey: template.seedKey,
      itemCount: template.items.length,
      updatedAt: template.updatedAt,
    }))
}

/** @deprecated use listScenarioTemplates */
export function listUserTemplates(userKey: string): ScenarioTemplateSummary[] {
  return listScenarioTemplates(userKey)
}

export function getScenarioTemplateById(userKey: string, id: string): ScenarioTemplate | null {
  return readAll(userKey).find((row) => row.id === id) ?? null
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
