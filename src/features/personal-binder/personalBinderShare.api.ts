import { apiRequest, resolveApiUrl } from '../../lib/apiClient'
import type { PersonalBinder } from './personalBinder.types'

export type SharedPersonalBinderSummary = {
  id: string
  title: string
  description: string
  ownerUserId: string
  ownerName: string | null
  gaId: number
  sectionCount: number
  fileCount: number
  totalBytes: number
  shareVersion: number
  sourceBinderId: string | null
  createdAt: string
  status: string
}

export type SharedPersonalBinderDetail = SharedPersonalBinderSummary & {
  sections: Array<{
    id: string
    title: string
    sortOrder: number
    items: Array<{
      id: string
      shareFileId: string
      sortOrder: number
      pageSelection: number[] | null
      material: {
        title: string
        originalFileName: string
        mimeType: string
        fileSize: number
        pageCount: number
      }
    }>
  }>
}

export type BinderShareStatus = {
  active: {
    shareId: string
    title: string
    createdAt: string
    status: string
  } | null
}

function auth(token: string | null) {
  if (!token?.trim()) throw new Error('로그인이 필요합니다.')
  return token
}

export function listSharedPersonalBinders(token: string | null, signal?: AbortSignal) {
  return apiRequest<SharedPersonalBinderSummary[]>('/api/personal-binders/shared', {
    token: auth(token),
    signal,
  })
}

export function getSharedPersonalBinder(
  token: string | null,
  shareId: string,
  signal?: AbortSignal,
) {
  return apiRequest<SharedPersonalBinderDetail>(`/api/personal-binders/shared/${shareId}`, {
    token: auth(token),
    signal,
  })
}

export function getPersonalBinderShareStatus(
  token: string | null,
  binderId: string,
  signal?: AbortSignal,
) {
  return apiRequest<BinderShareStatus>(`/api/personal-binders/${binderId}/share-status`, {
    token: auth(token),
    signal,
  })
}

export function sharePersonalBinderToGa(token: string | null, binderId: string) {
  return apiRequest<SharedPersonalBinderDetail>(`/api/personal-binders/${binderId}/share`, {
    method: 'POST',
    token: auth(token),
  })
}

export function revokeSharedPersonalBinder(token: string | null, shareId: string) {
  return apiRequest<{ ok: boolean }>(`/api/personal-binders/shared/${shareId}`, {
    method: 'DELETE',
    token: auth(token),
  })
}

export function importSharedPersonalBinder(
  token: string | null,
  shareId: string,
  idempotencyKey: string,
) {
  return apiRequest<{ binder: PersonalBinder; reused: boolean }>(
    `/api/personal-binders/shared/${shareId}/import`,
    {
      method: 'POST',
      token: auth(token),
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ idempotencyKey }),
    },
  )
}

export function sharedBinderFileDownloadUrl(shareId: string, shareFileId: string) {
  return `/api/personal-binders/shared/${encodeURIComponent(shareId)}/files/${encodeURIComponent(shareFileId)}/download`
}

export async function fetchSharedBinderFileBlob(
  token: string,
  shareId: string,
  shareFileId: string,
): Promise<Blob> {
  const url = resolveApiUrl(sharedBinderFileDownloadUrl(shareId, shareFileId))
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token.trim()}` },
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.blob()
}
