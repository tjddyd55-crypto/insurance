import type { ScenarioTemplate, ScenarioTemplateSummary } from '../domain/templateTypes'
import { previewTemplateStorageKey } from './previewStorageKeys'

function storageKey(userKey: string): string | null {
  return previewTemplateStorageKey(userKey)
}

function readAll(userKey: string): ScenarioTemplate[] {
  const key = storageKey(userKey)
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ScenarioTemplate[]
    return Array.isArray(parsed) ? parsed.filter((t) => t.sourceType === 'user') : []
  } catch {
    return []
  }
}

function writeAll(userKey: string, templates: ScenarioTemplate[]): void {
  const key = storageKey(userKey)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(templates))
}

export function listUserTemplates(userKey: string): ScenarioTemplateSummary[] {
  return readAll(userKey)
    .map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      sourceType: template.sourceType,
      itemCount: template.items.length,
      updatedAt: template.updatedAt,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getUserTemplateById(userKey: string, id: string): ScenarioTemplate | null {
  return readAll(userKey).find((row) => row.id === id) ?? null
}

export function saveUserTemplate(userKey: string, template: ScenarioTemplate): ScenarioTemplate {
  if (template.sourceType !== 'user') {
    throw new Error('Only user templates can be saved to local storage')
  }
  const next: ScenarioTemplate = {
    ...template,
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

export function deleteUserTemplate(userKey: string, id: string): void {
  writeAll(userKey, readAll(userKey).filter((row) => row.id !== id))
}
