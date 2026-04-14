import { ApiError, apiRequest } from '../../../lib/apiClient'

export type StorageFolderRow = {
  id: number
  name: string
  createdAt: string
}

export type StorageFileRow = {
  id: number
  customerId: number | null
  folderId: number | null
  content: string
  fileName: string
  originalName: string
  displayName: string
  objectKey: string | null
  filePath: string
  fileUrl: string
  fileSize: number | null
  mimeType: string | null
  isConfirmed: boolean
  createdAt: string
  expiresAt: string | null
  deletedAt: string | null
}

export type StorageFilePresignResponse = {
  uploadUrl: string
  fileUrl: string
  objectKey: string
  putHeaders?: Record<string, string>
  customerId: number | null
  displayName: string
}

type StorageFileScope = {
  customerId?: number | null
}

function assertToken(token: string) {
  if (!token?.trim()) {
    throw new ApiError('로그인이 필요합니다.', 401)
  }
}

function buildStorageScopeQuery(scope?: StorageFileScope & { folderId?: number | null }) {
  const q = new URLSearchParams()
  if (scope?.customerId != null) {
    q.set('customerId', String(scope.customerId))
  }
  if (scope?.folderId != null) {
    q.set('folderId', String(scope.folderId))
  }
  return q.toString() ? `?${q.toString()}` : ''
}

export async function listStorageFolders(token: string): Promise<StorageFolderRow[]> {
  assertToken(token)
  return apiRequest<StorageFolderRow[]>('/api/storage/folders', { token })
}

export async function createStorageFolder(token: string, name: string): Promise<StorageFolderRow> {
  assertToken(token)
  return apiRequest<StorageFolderRow>('/api/storage/folders', {
    method: 'POST',
    token,
    body: JSON.stringify({ name }),
  })
}

export async function renameStorageFolder(token: string, folderId: number, name: string): Promise<StorageFolderRow> {
  assertToken(token)
  return apiRequest<StorageFolderRow>(`/api/storage/folders/${folderId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ name }),
  })
}

export async function deleteStorageFolder(token: string, folderId: number): Promise<{ ok: boolean }> {
  assertToken(token)
  return apiRequest<{ ok: boolean }>(`/api/storage/folders/${folderId}`, {
    method: 'DELETE',
    token,
  })
}

export async function presignStorageFile(
  token: string,
  body: {
    fileName: string
    contentType: string
    sizeBytes: number
    customerId?: number | null
  },
): Promise<StorageFilePresignResponse> {
  assertToken(token)
  return apiRequest<StorageFilePresignResponse>('/api/storage/files/presign', {
    method: 'POST',
    token,
    body: JSON.stringify({
      fileName: body.fileName,
      contentType: body.contentType,
      size: body.sizeBytes,
      customerId: body.customerId ?? null,
    }),
  })
}

export async function revokeStorageStagedUpload(
  token: string,
  objectKey: string,
  scope?: StorageFileScope,
): Promise<{ ok: boolean }> {
  assertToken(token)
  return apiRequest<{ ok: boolean }>('/api/storage/files/revoke-staged', {
    method: 'POST',
    token,
    body: JSON.stringify({
      objectKey,
      customerId: scope?.customerId ?? null,
    }),
  })
}

export async function saveStorageFile(
  token: string,
  body: {
    fileName: string
    displayName?: string
    objectKey: string
    fileUrl: string
    size: number
    mimeType?: string | null
    content?: string
    folderId?: number | null
    customerId?: number | null
  },
): Promise<StorageFileRow> {
  assertToken(token)
  return apiRequest<StorageFileRow>('/api/storage/files', {
    method: 'POST',
    token,
    body: JSON.stringify({
      fileName: body.fileName,
      displayName: body.displayName ?? body.fileName,
      objectKey: body.objectKey,
      fileUrl: body.fileUrl,
      size: body.size,
      mimeType: body.mimeType ?? null,
      content: body.content ?? '',
      folderId: body.folderId ?? null,
      customerId: body.customerId ?? null,
    }),
  })
}

export async function listStorageFiles(
  token: string,
  scope?: StorageFileScope & { folderId?: number | null },
): Promise<StorageFileRow[]> {
  assertToken(token)
  const qs = buildStorageScopeQuery(scope)
  return apiRequest<StorageFileRow[]>(`/api/storage/files${qs}`, { token })
}

export async function renameStorageFile(
  token: string,
  fileId: number,
  displayName: string,
): Promise<StorageFileRow> {
  assertToken(token)
  return apiRequest<StorageFileRow>(`/api/storage/files/${fileId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ displayName }),
  })
}

export async function deleteStorageFile(token: string, fileId: number): Promise<{ ok: boolean }> {
  assertToken(token)
  return apiRequest<{ ok: boolean }>(`/api/storage/files/${fileId}`, {
    method: 'DELETE',
    token,
  })
}

export async function getStorageFileDownloadUrl(
  token: string,
  fileId: number,
): Promise<{ id: number; url: string; fileName: string }> {
  assertToken(token)
  return apiRequest<{ id: number; url: string; fileName: string }>(`/api/storage/files/${fileId}/download`, { token })
}
