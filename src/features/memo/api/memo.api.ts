import { apiRequest } from '../../../lib/apiClient'
import type { Note } from '../types/memo.types'

export const memoApi = {
  async getAll(token: string | null) {
    return apiRequest<Note[]>('/api/memo', { token })
  },

  async create(
    body: { content?: string; x?: number; y?: number },
    token: string | null,
  ) {
    return apiRequest<Note>('/api/memo', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    })
  },

  async update(
    id: string,
    body: Partial<Pick<Note, 'content' | 'x' | 'y'>>,
    token: string | null,
  ) {
    return apiRequest<Note>(`/api/memo/${encodeURIComponent(id)}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(body),
    })
  },

  async delete(id: string, token: string | null) {
    await apiRequest<{ success: boolean }>(`/api/memo/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      token,
    })
  },
}
