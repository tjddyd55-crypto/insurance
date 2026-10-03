import { apiRequest } from '../../../lib/apiClient'
import type { AiToolRegistryResponse } from '../types'

export async function fetchAiToolRegistry(token: string): Promise<AiToolRegistryResponse> {
  return apiRequest<AiToolRegistryResponse>('/api/admin/ai-tools', {
    method: 'GET',
    token,
  })
}
