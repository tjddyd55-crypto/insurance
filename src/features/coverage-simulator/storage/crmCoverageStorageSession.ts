import type { CoverageScenario } from '../domain/types'
import type { ScenarioTemplate } from '../domain/templateTypes'
import {
  apiSimulationToDomain,
  apiTemplateToDomain,
  createCoverageSimulationApi,
  createCoverageTemplateApi,
  deleteCoverageSimulationApi,
  deleteCoverageTemplateApi,
  duplicateCoverageTemplateApi,
  fetchCoverageSimulations,
  fetchCoverageTemplates,
  isServerNumericId,
  updateCoverageSimulationApi,
  updateCoverageTemplateApi,
} from './coverageSimulatorStorage.api'
import { readAllLocalConsultations } from './localConsultationRepository'

const MIGRATION_FLAG_PREFIX = 'onefc:coverage-simulator:migrated-to-server:v1:'

type SessionState = {
  userKey: string
  token: string
  templates: ScenarioTemplate[]
  consultations: CoverageScenario[]
  ready: boolean
  version: number
}

let session: SessionState | null = null
const listeners = new Set<() => void>()

function bumpVersion() {
  if (session) {
    session.version += 1
  }
  listeners.forEach((fn) => fn())
}

export function subscribeCrmCoverageStorage(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getCrmStorageVersion(): number {
  return session?.version ?? 0
}

export function isCrmCoverageStorageReady(userKey: string): boolean {
  return session?.userKey === userKey && session.ready
}

export function assertCrmCoverageStorageReady(userKey: string): void {
  if (!isCrmCoverageStorageReady(userKey)) {
    throw new Error('보장 시뮬레이션 데이터를 불러오는 중입니다.')
  }
}

function migrationFlagKey(userKey: string): string {
  return `${MIGRATION_FLAG_PREFIX}${userKey}`
}

async function importLegacyConsultations(token: string, userKey: string) {
  if (userKey === 'guest') return
  const legacy = readAllLocalConsultations(userKey)
  for (const row of legacy) {
    await createCoverageSimulationApi(token, {
      legacyClientId: row.id,
      title: row.title,
      diseaseType: row.diseaseType,
      description: row.description,
      customerId: row.customerId ?? null,
      customerNameSnapshot: row.customerNameSnapshot ?? null,
      consultationDate: row.consultationDate,
      items: row.items,
      templateId: row.templateId,
      templateNameSnapshot: row.templateNameSnapshot,
    })
  }
}

export async function hydrateCrmCoverageStorage(userKey: string, token: string): Promise<void> {
  if (session?.userKey === userKey && session.token === token && session.ready) {
    return
  }
  session = {
    userKey,
    token,
    templates: [],
    consultations: [],
    ready: false,
    version: 0,
  }
  const [templates, simulations] = await Promise.all([
    fetchCoverageTemplates(token),
    fetchCoverageSimulations(token),
  ])
  session.templates = templates.map(apiTemplateToDomain)
  session.consultations = simulations.map(apiSimulationToDomain)

  const migrated = localStorage.getItem(migrationFlagKey(userKey)) === '1'
  if (!migrated) {
    try {
      await importLegacyConsultations(token, userKey)
      const refreshed = await fetchCoverageSimulations(token)
      session.consultations = refreshed.map(apiSimulationToDomain)
      localStorage.setItem(migrationFlagKey(userKey), '1')
    } catch {
      // 실패 시 flag 미설정 — local legacy 유지
    }
  }

  session.ready = true
  bumpVersion()
}

export function resetCrmCoverageStorageSession(): void {
  session = null
}

export function listCrmUserTemplates(): ScenarioTemplate[] {
  assertCrmCoverageStorageReady(session!.userKey)
  return session!.templates.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getCrmUserTemplateById(id: string): ScenarioTemplate | null {
  assertCrmCoverageStorageReady(session!.userKey)
  return session!.templates.find((row) => row.id === id) ?? null
}

export async function saveCrmUserTemplate(template: ScenarioTemplate): Promise<ScenarioTemplate> {
  assertCrmCoverageStorageReady(session!.userKey)
  const token = session!.token
  const diseaseType = template.systemDiseaseType ?? 'custom'
  let saved: ScenarioTemplate
  if (isServerNumericId(template.id)) {
    const row = await updateCoverageTemplateApi(token, template.id, {
      name: template.name,
      description: template.description ?? '',
      diseaseType,
      items: template.items,
    })
    saved = apiTemplateToDomain(row)
    const idx = session!.templates.findIndex((t) => t.id === template.id)
    if (idx >= 0) session!.templates[idx] = saved
    else session!.templates.unshift(saved)
  } else {
    const row = await createCoverageTemplateApi(token, {
      name: template.name,
      description: template.description,
      diseaseType,
      items: template.items,
      legacyClientId: template.id,
    })
    saved = apiTemplateToDomain(row)
    session!.templates.unshift(saved)
  }
  bumpVersion()
  return saved
}

export async function deleteCrmUserTemplate(id: string): Promise<void> {
  assertCrmCoverageStorageReady(session!.userKey)
  await deleteCoverageTemplateApi(session!.token, id)
  session!.templates = session!.templates.filter((row) => row.id !== id)
  bumpVersion()
}

export async function duplicateCrmUserTemplate(id: string): Promise<ScenarioTemplate> {
  assertCrmCoverageStorageReady(session!.userKey)
  const row = await duplicateCoverageTemplateApi(session!.token, id)
  const saved = apiTemplateToDomain(row)
  session!.templates.unshift(saved)
  bumpVersion()
  return saved
}

export function listCrmConsultations(): CoverageScenario[] {
  assertCrmCoverageStorageReady(session!.userKey)
  return session!.consultations.slice()
}

export function getCrmConsultationById(id: string): CoverageScenario | null {
  assertCrmCoverageStorageReady(session!.userKey)
  return session!.consultations.find((row) => row.id === id) ?? null
}

export async function saveCrmConsultation(scenario: CoverageScenario): Promise<CoverageScenario> {
  assertCrmCoverageStorageReady(session!.userKey)
  const token = session!.token
  const payload = {
    title: scenario.title,
    diseaseType: scenario.diseaseType,
    description: scenario.description,
    customerId: scenario.customerId ?? null,
    customerNameSnapshot: scenario.customerNameSnapshot ?? null,
    consultationDate: scenario.consultationDate,
    items: scenario.items,
    templateId: scenario.templateId,
    templateNameSnapshot: scenario.templateNameSnapshot,
  }
  let saved: CoverageScenario
  if (isServerNumericId(scenario.id)) {
    const row = await updateCoverageSimulationApi(token, scenario.id, payload)
    saved = apiSimulationToDomain(row)
    const idx = session!.consultations.findIndex((c) => c.id === scenario.id)
    if (idx >= 0) session!.consultations[idx] = saved
    else session!.consultations.unshift(saved)
  } else {
    const row = await createCoverageSimulationApi(token, {
      ...payload,
      legacyClientId: scenario.id,
    })
    saved = apiSimulationToDomain(row)
    session!.consultations.unshift(saved)
  }
  bumpVersion()
  return saved
}

export async function deleteCrmConsultation(id: string): Promise<void> {
  assertCrmCoverageStorageReady(session!.userKey)
  await deleteCoverageSimulationApi(session!.token, id)
  session!.consultations = session!.consultations.filter((row) => row.id !== id)
  bumpVersion()
}
