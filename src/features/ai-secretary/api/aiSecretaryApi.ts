import { apiRequest, resolveApiUrl } from '../../../lib/apiClient'

export type ImportMappingRow = {
  columnIndex: number
  colKey: string
  sourceColumn: string
  destinationField: string | null
  destinationLabel: string | null
  status: 'confirmed' | 'review' | 'unmapped' | 'ignored'
  confidence: number | null
}

export type ImportAnalysisProgress = {
  totalBlocks?: number
  blocksProcessed?: number
  semanticGptEligible?: number
  semanticGptPlanned?: number
  semanticGptAttempts?: number
  semanticGptSucceeded?: number
  semanticGptFailed?: number
  semanticGptResolved?: number
  semanticGptLowConfidence?: number
  semanticGptSkippedByLimit?: number
  semanticGptTimeout?: number
}

export type ImportAnalysisJobResponse = {
  jobId: string
  importSessionId: string
  status: string
  displayPhase?: string
  progress?: ImportAnalysisProgress
  stats?: Record<string, unknown>
  warning?: string | null
  error?: { code?: string; message?: string } | null
  preview?: {
    summary?: Record<string, number>
    previewVersionHash?: string
    confirmationId?: string
    duplicatePolicy?: string
  } | null
}

export type AiPageContext = {
  currentRoute: string
  currentEntityType: 'customer' | null
  currentEntityId: string | null
}

export type AiAssistantMessage =
  | { role: 'user' | 'assistant'; kind: 'text'; text: string }
  | { role: 'assistant'; kind: 'status'; text: string }
  | {
      role: 'assistant'
      kind: 'import_analysis_progress'
      text: string
      jobId: string
      importSessionId: string
      status: string
      displayPhase?: string
      progress?: ImportAnalysisProgress
    }
  | {
      role: 'assistant'
      kind: 'import_preview_card'
      text: string
      statusLabel?: string
      mappingRows?: ImportMappingRow[]
      issueRows?: Array<{
        sourceRowNumber: number
        status: string
        reasons: string[]
        identifier: string
        phoneMasked?: string | null
        mappedPreview?: {
          name?: string | null
          phoneMasked?: string | null
          address?: string | null
          job?: string | null
          carNumber?: string | null
          carModel?: string | null
          sourceCell?: string | null
          warnings?: string[]
        }
      }>
      preview: {
        fileName?: string
        summary: Record<string, number> & { duplicateTotal?: number; needsReview?: number }
        previewVersionHash: string
        confirmationId: string
        duplicatePolicy?: string
      }
    }
  | {
      role: 'assistant'
      kind: 'import_commit_result_card'
      text: string
      summary: { requested?: number; created?: number; skipped?: number; failed?: number }
      customerListPath?: string
    }
  | { role: 'assistant'; kind: 'error'; text: string; code?: string }

export async function fetchLatestAiConversation(token: string) {
  return apiRequest<{
    conversation: {
      conversationId: string
      importSessionId?: string | null
      importContext?: Record<string, unknown> | null
      messages?: AiAssistantMessage[]
    } | null
  }>('/api/ai/assistant/conversations/latest', { token })
}

export async function uploadAiImportFile(
  token: string,
  file: File,
  options?: { conversationId?: string },
) {
  const form = new FormData()
  form.append('file', file)
  if (options?.conversationId) {
    form.append('conversationId', options.conversationId)
  }
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
  body: {
    conversationId?: string
    text: string
    importSessionId?: string
    pageContext?: AiPageContext
  },
) {
  return apiRequest<{ conversationId: string; messages: AiAssistantMessage[]; analysisJobId?: string }>(
    '/api/ai/assistant/messages',
    {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    },
  )
}

export async function fetchImportAnalysisJob(token: string, jobId: string) {
  return apiRequest<ImportAnalysisJobResponse>(`/api/ai/assistant/import-analysis-jobs/${jobId}`, { token })
}

export async function startImportAnalysisJob(
  token: string,
  importSessionId: string,
  body?: { conversationId?: string; duplicatePolicy?: string },
) {
  return apiRequest<ImportAnalysisJobResponse>(
    `/api/ai/assistant/import-sessions/${importSessionId}/analyze`,
    {
      method: 'POST',
      token,
      body: JSON.stringify(body ?? {}),
    },
  )
}

export async function fetchImportMapping(token: string, importSessionId: string) {
  return apiRequest<{
    mappingRows: ImportMappingRow[]
    availableFields: Array<{ key: string; label: string }>
    duplicatePolicy: string
  }>(`/api/ai/assistant/import-sessions/${importSessionId}/mapping`, { token })
}

export async function updateImportMapping(
  token: string,
  importSessionId: string,
  body: {
    columnMapping: Record<string, string>
    conversationId?: string
    duplicatePolicy?: string
  },
) {
  return apiRequest<{ conversationId: string; messages: AiAssistantMessage[] }>(
    `/api/ai/assistant/import-sessions/${importSessionId}/mapping`,
    {
      method: 'PUT',
      token,
      body: JSON.stringify(body),
    },
  )
}

export async function confirmAiImportCommit(
  token: string,
  confirmationId: string,
  body: { importSessionId: string; previewVersionHash: string; duplicatePolicy?: string },
) {
  return apiRequest<{
    summary?: { requested?: number; created?: number; skipped?: number; failed?: number }
    skipped?: unknown[]
    failures?: unknown[]
  }>(`/api/ai/assistant/confirmations/${confirmationId}/commit`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}
