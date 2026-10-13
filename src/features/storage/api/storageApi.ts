import { ApiError, apiRequest, resolveAbsoluteApiUrl, resolveApiUrl } from '../../../lib/apiClient'
import { putFileToPresignedR2Url } from '../../../lib/presignedR2Put'

export type StorageFolderRow = {
  id: number
  name: string
  customerId?: number | null
  parentId?: number | null
  createdAt: string
}

export type StorageFileRow = {
  id: number
  customerId: number | null
  teamId?: string | null
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
  uploadStatus?: string
  createdAt: string
  expiresAt: string | null
  deletedAt: string | null
}

/** 목록에 표시된 파일의 사전 발급 다운로드(open-token attachment) URL */
export type StorageFileDownloadLinkEntry = {
  href: string
  createdAt: number
}

export type StorageFilePresignResponse = {
  /** presign 시 생성된 uploading 행 id — save 시 반드시 전달 */
  fileId: number
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

function buildFolderListQuery(scope?: StorageFileScope) {
  const q = new URLSearchParams()
  if (scope?.customerId != null) {
    q.set('customerId', String(scope.customerId))
  }
  return q.toString() ? `?${q.toString()}` : ''
}

/**
 * 읽기 계열 API 에 `signal` 옵션을 받아 호출자(useEffect cleanup 등) 가 취소할 수 있게 한다.
 * 기존 호출부는 signal 없이 호출해도 동작하도록 선택적 매개변수로 유지.
 */
type ReadOptions = { signal?: AbortSignal }

export async function listStorageFolders(
  token: string,
  scope?: StorageFileScope,
  options: ReadOptions = {},
): Promise<StorageFolderRow[]> {
  assertToken(token)
  const qs = buildFolderListQuery(scope)
  return apiRequest<StorageFolderRow[]>(`/api/storage/folders${qs}`, {
    token,
    signal: options.signal,
  })
}

export async function createStorageFolder(
  token: string,
  name: string,
  scope?: StorageFileScope & { parentId?: number | null },
): Promise<StorageFolderRow> {
  assertToken(token)
  return apiRequest<StorageFolderRow>('/api/storage/folders', {
    method: 'POST',
    token,
    body: JSON.stringify({
      name,
      customerId: scope?.customerId ?? null,
      parentId: scope?.parentId ?? null,
    }),
  })
}

export type PersonalStorageQuota = {
  usedBytes: number
  limitBytes: number
  /** uploading 상태 파일 크기 합 (storage_used 미포함) */
  pendingUploadBytes?: number
}

export async function getPersonalStorageQuota(
  token: string,
  options: ReadOptions = {},
): Promise<PersonalStorageQuota> {
  assertToken(token)
  return apiRequest<PersonalStorageQuota>('/api/storage/quota', {
    token,
    signal: options.signal,
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
  const customerId = body.customerId ?? null
  const path =
    customerId != null && Number.isInteger(customerId)
      ? `/api/customers/${customerId}/files/presign`
      : '/api/storage/files/presign'
  return apiRequest<StorageFilePresignResponse>(path, {
    method: 'POST',
    token,
    body: JSON.stringify({
      fileName: body.fileName,
      contentType: body.contentType,
      size: body.sizeBytes,
      customerId,
    }),
  })
}

function resolveStorageUploadProxyPath(customerId?: number | null): string {
  if (customerId != null && Number.isInteger(customerId)) {
    return `/api/customers/${customerId}/files/upload-proxy`
  }
  return '/api/storage/files/upload-proxy'
}

/** presign 후 R2 직접 PUT, CORS 실패 시 서버 upload-proxy 경유 (save는 호출자가 수행). */
export async function putStoragePresignedFile(
  token: string,
  presign: Pick<StorageFilePresignResponse, 'uploadUrl' | 'objectKey' | 'fileId' | 'putHeaders'>,
  file: File,
  contentType: string,
  scope?: StorageFileScope,
): Promise<void> {
  assertToken(token)
  let directOk = false
  try {
    await putFileToPresignedR2Url(presign.uploadUrl, file, contentType, presign.putHeaders)
    directOk = true
  } catch {
    directOk = false
  }
  if (directOk) {
    return
  }

  const q = new URLSearchParams({
    uploadFileId: String(presign.fileId),
    objectKey: presign.objectKey,
    contentType,
  })
  const customerId = scope?.customerId ?? null
  if (customerId != null) {
    q.set('customerId', String(customerId))
  }
  const proxyPath = resolveStorageUploadProxyPath(customerId)
  let proxyRes: Response
  try {
    proxyRes = await fetch(resolveApiUrl(`${proxyPath}?${q.toString()}`), {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        Authorization: `Bearer ${token.trim()}`,
      },
      body: file,
    })
  } catch {
    throw new ApiError(
      '스토리지로 파일을 전송하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
      0,
    )
  }
  if (!proxyRes.ok) {
    let message = `파일 업로드에 실패했습니다. (${proxyRes.status})`
    try {
      const errBody = (await proxyRes.json()) as { message?: string }
      if (errBody?.message?.trim()) {
        message = String(errBody.message).trim()
      }
    } catch {
      /* non-JSON */
    }
    throw new ApiError(message, proxyRes.status)
  }
}

export async function revokeStorageStagedUpload(
  token: string,
  objectKey: string,
  scope?: StorageFileScope & { fileId?: number | null },
): Promise<{ ok: boolean }> {
  assertToken(token)
  return apiRequest<{ ok: boolean }>('/api/storage/files/revoke-staged', {
    method: 'POST',
    token,
    body: JSON.stringify({
      objectKey,
      fileId: scope?.fileId ?? null,
      customerId: scope?.customerId ?? null,
    }),
  })
}

export async function markStorageUploadFailed(
  token: string,
  fileId: number,
): Promise<{ ok: boolean; fileId: number }> {
  assertToken(token)
  return apiRequest<{ ok: boolean; fileId: number }>('/api/storage/files/upload-fail', {
    method: 'POST',
    token,
    body: JSON.stringify({ fileId }),
  })
}

export async function saveStorageFile(
  token: string,
  body: {
    fileId: number
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
      fileId: body.fileId,
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
  options: ReadOptions = {},
): Promise<StorageFileRow[]> {
  assertToken(token)
  const qs = buildStorageScopeQuery(scope)
  return apiRequest<StorageFileRow[]>(`/api/storage/files${qs}`, {
    token,
    signal: options.signal,
  })
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

export type StorageFileBinderDeleteImpact = {
  materialCount: number
  binderCount: number
  binderItemCount: number
  binders: { id: string; title: string; itemCount: number }[]
  materials: { id: string; title: string }[]
}

export async function fetchStorageFileBinderDeleteImpact(
  token: string,
  fileId: number,
): Promise<StorageFileBinderDeleteImpact> {
  assertToken(token)
  return apiRequest<StorageFileBinderDeleteImpact>(
    `/api/storage/files/${fileId}/binder-delete-impact`,
    { method: 'GET', token },
  )
}

export async function deleteStorageFile(
  token: string,
  fileId: number,
  options?: { confirmBinderCleanup?: boolean; acknowledgedBinderItemCount?: number },
): Promise<{ ok: boolean }> {
  assertToken(token)
  const q = options?.confirmBinderCleanup ? '?confirmBinderCleanup=true' : ''
  const body =
    options?.confirmBinderCleanup || options?.acknowledgedBinderItemCount != null
      ? JSON.stringify({
          confirmBinderCleanup: options?.confirmBinderCleanup === true,
          ...(options?.acknowledgedBinderItemCount != null
            ? { acknowledgedBinderItemCount: options.acknowledgedBinderItemCount }
            : {}),
        })
      : undefined
  return apiRequest<{ ok: boolean }>(`/api/storage/files/${fileId}${q}`, {
    method: 'DELETE',
    token,
    body,
  })
}

/** Content-Disposition에서 파일명 추출 (UTF-8 filename* 우선) */
export function parseContentDispositionFilename(headerValue: string | null): string | null {
  if (!headerValue?.trim()) {
    return null
  }
  const utf8Star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;\s]+)/i.exec(headerValue)
  if (utf8Star?.[1]) {
    try {
      return decodeURIComponent(utf8Star[1].trim())
    } catch {
      return null
    }
  }
  const quoted = /filename\s*=\s*"((?:\\.|[^"\\])*)"/i.exec(headerValue)
  if (quoted?.[1]) {
    return quoted[1].replace(/\\(.)/g, '$1')
  }
  const plain = /filename\s*=\s*([^;\s]+)/i.exec(headerValue)
  if (plain?.[1]) {
    return plain[1].replace(/^["']|["']$/g, '')
  }
  return null
}

/**
 * 짧은 수명 `open` URL(attachment) — 브라우저가 직접 GET 하므로 Authorization 헤더 없이도 동작합니다.
 */
export async function createStorageFileDownloadUrl(token: string, fileId: number): Promise<string> {
  assertToken(token)
  const { openUrl } = await apiRequest<{ openUrl: string }>(`/api/storage/files/${fileId}/open-token`, {
    method: 'POST',
    token,
    body: JSON.stringify({ disposition: 'attachment' }),
  })
  return resolveAbsoluteApiUrl(openUrl)
}

export async function createStorageFilePreviewUrl(token: string, fileId: number): Promise<string> {
  assertToken(token)
  const { openUrl } = await apiRequest<{ openUrl: string }>(
    `/api/storage/files/${fileId}/open-token`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ disposition: 'inline' }),
    },
  )
  return resolveAbsoluteApiUrl(openUrl)
}

/**
 * 열기(확인용): inline open-token 으로 새 창/내장 뷰어에서 미리보기합니다.
 * (`window.open` — 다운로드 전용 로직과 합치지 말 것)
 */
export async function openStorageFile(token: string, fileId: number): Promise<void> {
  assertToken(token)
  const { openUrl } = await apiRequest<{ openUrl: string }>(`/api/storage/files/${fileId}/open-token`, {
    method: 'POST',
    token,
    body: JSON.stringify({}),
  })
  const href = resolveAbsoluteApiUrl(openUrl)
  window.open(href, '_blank', 'noopener,noreferrer')
}
