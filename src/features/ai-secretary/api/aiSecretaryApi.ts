import { apiRequest, resolveApiUrl } from '../../../lib/apiClient'

export type AiAssistantMessage =
  | { role: 'user' | 'assistant'; kind: 'text'; text: string }
  | {
      role: 'assistant'
      kind: 'import_preview_card'
      text: string
      preview: {
        fileName?: string
        summary: Record<string, number>
        previewVersionHash: string
        confirmationId: string
      }
    }
  | { role: 'assistant'; kind: 'error'; text: string; code?: string }

export async function fetchLatestAiConversation(token: string) {
  return apiRequest<{
    conversation: {
      conversationId: string
      importSessionId?: string | null
      messages?: AiAssistantMessage[]
    } | null
  }>('/api/ai/assistant/conversations/latest', { token })
}

export async function uploadAiImportFile(token: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(resolveApiUrl('/api/ai/assistant/attachments/import-file'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? '파일 첨부에 실패했습니다.')
  }
  return res.json() as Promise<{ importSessionId: string }>
}

export async function sendAiAssistantMessage(
  token: string,
  body: { conversationId?: string; text: string; importSessionId?: string },
) {
  return apiRequest<{ conversationId: string; messages: AiAssistantMessage[] }>('/api/ai/assistant/messages', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export async function confirmAiImportCommit(
  token: string,
  confirmationId: string,
  body: { importSessionId: string; previewVersionHash: string; duplicatePolicy?: string },
) {
  return apiRequest(`/api/ai/assistant/confirmations/${confirmationId}/commit`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}
