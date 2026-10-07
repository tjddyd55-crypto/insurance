import { apiRequest } from '../../../lib/apiClient'
import type {
  AiDatabaseCatalog,
  AiImprovementItem,
  AiImprovementStatus,
  AiToolRegistryResponse,
} from '../types'

export async function fetchAiToolRegistry(token: string): Promise<AiToolRegistryResponse> {
  return apiRequest<AiToolRegistryResponse>('/api/admin/ai-tools', {
    method: 'GET',
    token,
  })
}


export async function fetchAiImprovements(token: string): Promise<AiImprovementItem[]> {
  const result = await apiRequest<{ items: AiImprovementItem[] }>('/api/admin/ai-improvements', {
    method: 'GET',
    token,
  })
  return result.items ?? []
}

export async function updateAiImprovementStatus(
  token: string,
  id: number,
  status: AiImprovementStatus,
): Promise<AiImprovementItem> {
  const result = await apiRequest<{ item: AiImprovementItem }>(`/api/admin/ai-improvements/${id}/status`, {
    method: 'PATCH',
    token,
    body: { status },
  })
  return result.item
}

export async function fetchAiDatabaseCatalog(token: string): Promise<AiDatabaseCatalog> {
  return apiRequest<AiDatabaseCatalog>('/api/admin/ai-data-catalog', {
    method: 'GET',
    token,
  })
}
