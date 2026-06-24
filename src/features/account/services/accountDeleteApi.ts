import { apiRequest } from '../../../lib/apiClient'

export async function requestAccountDeletion(
  token: string,
): Promise<{ ok: boolean; message?: string }> {
  return apiRequest('/api/account/delete-request', {
    method: 'POST',
    token,
    body: JSON.stringify({}),
  })
}
