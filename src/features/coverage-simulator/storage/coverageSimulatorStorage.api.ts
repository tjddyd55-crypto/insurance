import { apiRequest } from '../../../lib/apiClient'
import type { CoverageScenario, DiseaseType } from '../domain/types'
import type { ScenarioTemplate } from '../domain/templateTypes'

export type ApiScenarioTemplate = {
  id: string
  legacyClientId?: string | null
  name: string
  description?: string
  sourceType: 'user'
  diseaseType: DiseaseType
  items: ScenarioTemplate['items']
  createdAt: string
  updatedAt: string
}

export type ApiCoverageSimulation = CoverageScenario & {
  legacyClientId?: string | null
}

function authOpts(token: string) {
  return { token, method: 'GET' as const }
}

export async function fetchCoverageTemplates(token: string): Promise<ApiScenarioTemplate[]> {
  const res = await apiRequest<{ templates: ApiScenarioTemplate[] }>('/api/coverage-simulator/templates', {
    ...authOpts(token),
  })
  return res.templates ?? []
}

export async function fetchCoverageTemplate(token: string, id: string): Promise<ApiScenarioTemplate> {
  return apiRequest<ApiScenarioTemplate>(`/api/coverage-simulator/templates/${id}`, authOpts(token))
}

export async function createCoverageTemplateApi(
  token: string,
  body: {
    name: string
    description?: string
    diseaseType?: DiseaseType
    items: ScenarioTemplate['items']
    legacyClientId?: string | null
  },
): Promise<ApiScenarioTemplate> {
  return apiRequest<ApiScenarioTemplate>('/api/coverage-simulator/templates', {
    token,
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateCoverageTemplateApi(
  token: string,
  id: string,
  body: Partial<{
    name: string
    description: string
    diseaseType: DiseaseType
    items: ScenarioTemplate['items']
  }>,
): Promise<ApiScenarioTemplate> {
  return apiRequest<ApiScenarioTemplate>(`/api/coverage-simulator/templates/${id}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function duplicateCoverageTemplateApi(token: string, id: string): Promise<ApiScenarioTemplate> {
  return apiRequest<ApiScenarioTemplate>(`/api/coverage-simulator/templates/${id}/duplicate`, {
    token,
    method: 'POST',
  })
}

export async function deleteCoverageTemplateApi(token: string, id: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/coverage-simulator/templates/${id}`, {
    token,
    method: 'DELETE',
  })
}

export async function fetchCoverageSimulations(
  token: string,
  query?: { customerId?: string; diseaseType?: DiseaseType },
): Promise<ApiCoverageSimulation[]> {
  const params = new URLSearchParams()
  if (query?.customerId) params.set('customerId', query.customerId)
  if (query?.diseaseType) params.set('diseaseType', query.diseaseType)
  const qs = params.toString()
  const path = qs ? `/api/coverage-simulator/simulations?${qs}` : '/api/coverage-simulator/simulations'
  const res = await apiRequest<{ simulations: ApiCoverageSimulation[] }>(path, authOpts(token))
  return res.simulations ?? []
}

export async function fetchCoverageSimulation(token: string, id: string): Promise<ApiCoverageSimulation> {
  return apiRequest<ApiCoverageSimulation>(`/api/coverage-simulator/simulations/${id}`, authOpts(token))
}

export async function createCoverageSimulationApi(
  token: string,
  body: {
    title: string
    diseaseType: DiseaseType
    description?: string
    customerId?: string | null
    customerNameSnapshot?: string | null
    consultationDate: string
    items: CoverageScenario['items']
    templateId?: string
    templateNameSnapshot?: string
    legacyClientId?: string | null
  },
): Promise<ApiCoverageSimulation> {
  return apiRequest<ApiCoverageSimulation>('/api/coverage-simulator/simulations', {
    token,
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateCoverageSimulationApi(
  token: string,
  id: string,
  body: Partial<CoverageScenario>,
): Promise<ApiCoverageSimulation> {
  return apiRequest<ApiCoverageSimulation>(`/api/coverage-simulator/simulations/${id}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteCoverageSimulationApi(token: string, id: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/coverage-simulator/simulations/${id}`, {
    token,
    method: 'DELETE',
  })
}

export function apiTemplateToDomain(row: ApiScenarioTemplate): ScenarioTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sourceType: 'user',
    systemDiseaseType: row.diseaseType,
    items: row.items,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function apiSimulationToDomain(row: ApiCoverageSimulation): CoverageScenario {
  return {
    ...row,
    kind: 'consultation',
    customerName: row.customerNameSnapshot ?? row.customerName ?? undefined,
  }
}

export function isServerNumericId(id: string): boolean {
  return /^\d+$/.test(id.trim())
}
