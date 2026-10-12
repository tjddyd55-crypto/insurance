import { apiRequest, resolveApiUrl } from '../../../lib/apiClient'

export type GaGroupRow = {
  id: number
  name: string
  slug: string
  logoUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  gaCount?: number
}

export type GaGroupMemberRow = {
  id: number
  name: string
  code: string
  status: string
  linkedAt: string
}

export type GaGroupSearchGaRow = {
  id: number
  name: string
  code: string
  status: string
  groupId: number | null
  groupName: string | null
  groupSlug: string | null
  inOtherGroup: boolean
}

export type GaGroupExcelPreviewRow = {
  rowNumber: number
  branchName: string
  gaCode: string
  status: string
  message: string
  gaId?: number
  gaName?: string
  proposedCode?: string
  needsNameConfirm?: boolean
  currentGroupName?: string
}

export async function listGaGroups(token: string): Promise<GaGroupRow[]> {
  return apiRequest<GaGroupRow[]>('/api/admin/ga-groups', { method: 'GET', token })
}

export async function createGaGroup(
  token: string,
  body: { name: string; slug: string },
): Promise<GaGroupRow> {
  return apiRequest<GaGroupRow>('/api/admin/ga-groups', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export async function patchGaGroup(
  token: string,
  groupId: number,
  body: Partial<{ name: string; slug: string; logoUrl: string | null; isActive: boolean }>,
): Promise<GaGroupRow> {
  return apiRequest<GaGroupRow>(`/api/admin/ga-groups/${groupId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function listGaGroupMembers(token: string, groupId: number): Promise<GaGroupMemberRow[]> {
  return apiRequest<GaGroupMemberRow[]>(`/api/admin/ga-groups/${groupId}/members`, {
    method: 'GET',
    token,
  })
}

export async function searchGasForGaGroup(
  token: string,
  q: string,
  excludeGroupId?: number,
): Promise<GaGroupSearchGaRow[]> {
  const params = new URLSearchParams()
  if (q.trim()) {
    params.set('q', q.trim())
  }
  if (excludeGroupId != null) {
    params.set('excludeGroupId', String(excludeGroupId))
  }
  const qs = params.toString()
  return apiRequest<GaGroupSearchGaRow[]>(
    `/api/admin/ga-groups/ga-search${qs ? `?${qs}` : ''}`,
    { method: 'GET', token },
  )
}

export async function linkGasToGaGroup(
  token: string,
  groupId: number,
  gaIds: number[],
  confirmMove = false,
): Promise<{ ok: boolean; linked: number }> {
  return apiRequest(`/api/admin/ga-groups/${groupId}/members`, {
    method: 'POST',
    token,
    body: JSON.stringify({ gaIds, confirmMove }),
  })
}

export async function unlinkGaFromGaGroup(
  token: string,
  groupId: number,
  gaId: number,
): Promise<void> {
  await apiRequest(`/api/admin/ga-groups/${groupId}/members/${gaId}`, {
    method: 'DELETE',
    token,
  })
}

export type GaGroupLogoPresign = {
  uploadUrl: string
  publicUrl: string
  storageKey: string
  contentType: string
}

export async function presignGaGroupLogo(
  token: string,
  groupId: number,
  file: File,
): Promise<GaGroupLogoPresign> {
  return apiRequest<GaGroupLogoPresign>(`/api/admin/ga-groups/${groupId}/logo/presign`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  })
}

export async function uploadGaGroupLogoFile(presign: GaGroupLogoPresign, file: File): Promise<void> {
  const uploadUrl = /^https?:\/\//i.test(presign.uploadUrl)
    ? presign.uploadUrl
    : resolveApiUrl(presign.uploadUrl)
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': presign.contentType || file.type },
    body: file,
  })
  if (!res.ok) {
    throw new Error('로고 업로드에 실패했습니다.')
  }
}

export async function previewGaGroupExcel(
  token: string,
  groupId: number,
  file: File,
): Promise<{
  preview: GaGroupExcelPreviewRow[]
  fileHash: string
  duplicateFile: boolean
  summary: Record<string, number>
}> {
  const form = new FormData()
  form.append('file', file)
  const url = resolveApiUrl(`/api/admin/ga-groups/${groupId}/excel/preview`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(String(body?.message ?? '엑셀 검증에 실패했습니다.'))
  }
  return (await res.json()) as Awaited<ReturnType<typeof previewGaGroupExcel>>
}

export async function commitGaGroupExcel(
  token: string,
  groupId: number,
  payload: {
    preview: GaGroupExcelPreviewRow[]
    fileHash: string
    allowMoveFromOtherGroup?: boolean
    confirmSimilarNames?: boolean
    forceDuplicateFile?: boolean
  },
): Promise<{ ok: boolean; summary: Record<string, number> }> {
  return apiRequest(`/api/admin/ga-groups/${groupId}/excel/commit`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export type PublicGaGroupInfo = {
  name: string
  slug: string
  logoUrl: string | null
}

export type PublicGaGroupGa = { id: number; name: string; code: string }

export async function fetchPublicGaGroup(slug: string): Promise<PublicGaGroupInfo | null> {
  const url = resolveApiUrl(`/api/public/ga-groups/${encodeURIComponent(slug)}`)
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return null
    }
    const body = (await res.json()) as { success?: boolean; data?: PublicGaGroupInfo }
    return body.data ?? null
  } catch {
    return null
  }
}

export type PublicGaGroupGasSearchResult = {
  data: PublicGaGroupGa[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
  nextOffset: number | null
}

export async function searchPublicGaGroupGas(
  slug: string,
  q: string,
  options?: { limit?: number; offset?: number },
): Promise<PublicGaGroupGasSearchResult> {
  const params = new URLSearchParams()
  if (q.trim()) {
    params.set('q', q.trim())
  }
  if (options?.limit != null) {
    params.set('limit', String(options.limit))
  }
  if (options?.offset != null) {
    params.set('offset', String(options.offset))
  }
  const empty: PublicGaGroupGasSearchResult = {
    data: [],
    total: 0,
    limit: options?.limit ?? 30,
    offset: options?.offset ?? 0,
    hasMore: false,
    nextOffset: null,
  }
  const url = resolveApiUrl(
    `/api/public/ga-groups/${encodeURIComponent(slug)}/gas?${params.toString()}`,
  )
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return empty
    }
    const body = (await res.json()) as Partial<PublicGaGroupGasSearchResult> & {
      data?: PublicGaGroupGa[]
    }
    const data = body.data ?? []
    const total = Number(body.total ?? data.length)
    const limit = Number(body.limit ?? options?.limit ?? 30)
    const offset = Number(body.offset ?? options?.offset ?? 0)
    const hasMore = Boolean(body.hasMore ?? offset + data.length < total)
    const nextOffset =
      body.nextOffset != null ? Number(body.nextOffset) : hasMore ? offset + data.length : null
    return { data, total, limit, offset, hasMore, nextOffset }
  } catch {
    return empty
  }
}

export function buildGaGroupLandingPath(slug: string): string {
  return `/g/${encodeURIComponent(slug)}`
}

export function buildGaGroupSignupPath(slug: string): string {
  return `/g/${encodeURIComponent(slug)}/signup`
}
