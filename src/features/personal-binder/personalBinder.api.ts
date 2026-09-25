import { apiRequest } from '../../lib/apiClient'
import type {
  PersonalBinder,
  PersonalBinderMaterial,
  PersonalBinderSection,
  PersonalBinderSummary,
} from './personalBinder.types'

function auth(token: string | null) {
  if (!token?.trim()) throw new Error('로그인이 필요합니다.')
  return token
}

export function listPersonalBinders(token: string | null, signal?: AbortSignal) {
  return apiRequest<PersonalBinderSummary[]>('/api/personal-binders', {
    token: auth(token),
    signal,
  })
}

export function getPersonalBinder(token: string | null, binderId: string, signal?: AbortSignal) {
  return apiRequest<PersonalBinder>(`/api/personal-binders/${binderId}`, {
    token: auth(token),
    signal,
  })
}

export function createPersonalBinder(
  token: string | null,
  input: { title: string; description?: string },
) {
  return apiRequest<PersonalBinderSummary>('/api/personal-binders', {
    method: 'POST',
    token: auth(token),
    body: JSON.stringify(input),
  })
}

export function updatePersonalBinder(
  token: string | null,
  binderId: string,
  input: { title: string; description?: string },
) {
  return apiRequest<PersonalBinder>(`/api/personal-binders/${binderId}`, {
    method: 'PATCH',
    token: auth(token),
    body: JSON.stringify(input),
  })
}

export function deletePersonalBinder(token: string | null, binderId: string) {
  return apiRequest<{ ok: boolean }>(`/api/personal-binders/${binderId}`, {
    method: 'DELETE',
    token: auth(token),
  })
}

export function duplicatePersonalBinder(
  token: string | null,
  binderId: string,
  title?: string,
) {
  return apiRequest<PersonalBinder>(`/api/personal-binders/${binderId}/duplicate`, {
    method: 'POST',
    token: auth(token),
    body: JSON.stringify({ title }),
  })
}

export function listPersonalBinderMaterials(token: string | null, signal?: AbortSignal) {
  return apiRequest<PersonalBinderMaterial[]>('/api/personal-binders/materials', {
    token: auth(token),
    signal,
  })
}

export function checkDuplicateBinderMaterial(token: string | null, checksumSha256: string) {
  return apiRequest<{ duplicate: boolean; material: PersonalBinderMaterial | null }>(
    '/api/personal-binders/materials/check-duplicate',
    {
      method: 'POST',
      token: auth(token),
      body: JSON.stringify({ checksumSha256 }),
    },
  )
}

export function createPersonalBinderMaterial(
  token: string | null,
  input: { fileId: number; title: string },
) {
  return apiRequest<PersonalBinderMaterial>('/api/personal-binders/materials', {
    method: 'POST',
    token: auth(token),
    body: JSON.stringify(input),
  })
}

export function renamePersonalBinderMaterial(
  token: string | null,
  materialId: string,
  title: string,
) {
  return apiRequest<PersonalBinderMaterial>(
    `/api/personal-binders/materials/${materialId}`,
    {
      method: 'PATCH',
      token: auth(token),
      body: JSON.stringify({ title }),
    },
  )
}

export function deletePersonalBinderMaterial(token: string | null, materialId: string) {
  return apiRequest<{ ok: boolean; fileId: number }>(
    `/api/personal-binders/materials/${materialId}`,
    {
      method: 'DELETE',
      token: auth(token),
    },
  )
}

export function createPersonalBinderSection(
  token: string | null,
  binderId: string,
  title: string,
) {
  return apiRequest<PersonalBinderSection>(
    `/api/personal-binders/${binderId}/sections`,
    {
      method: 'POST',
      token: auth(token),
      body: JSON.stringify({ title }),
    },
  )
}

export function renamePersonalBinderSection(
  token: string | null,
  sectionId: string,
  title: string,
) {
  return apiRequest<{ ok: boolean }>(
    `/api/personal-binders/sections/${sectionId}`,
    {
      method: 'PATCH',
      token: auth(token),
      body: JSON.stringify({ title }),
    },
  )
}

export function deletePersonalBinderSection(token: string | null, sectionId: string) {
  return apiRequest<{ ok: boolean }>(
    `/api/personal-binders/sections/${sectionId}`,
    {
      method: 'DELETE',
      token: auth(token),
    },
  )
}

export function reorderPersonalBinderSections(
  token: string | null,
  binderId: string,
  sectionIds: string[],
) {
  return apiRequest<{ ok: boolean }>(
    `/api/personal-binders/${binderId}/sections/reorder`,
    {
      method: 'PUT',
      token: auth(token),
      body: JSON.stringify({ sectionIds }),
    },
  )
}

export function addPersonalBinderItem(
  token: string | null,
  sectionId: string,
  input: { materialId: string; pageSelection: number[] | null },
) {
  return apiRequest<{ id: string }>(
    `/api/personal-binders/sections/${sectionId}/items`,
    {
      method: 'POST',
      token: auth(token),
      body: JSON.stringify(input),
    },
  )
}

export function updatePersonalBinderItemPages(
  token: string | null,
  itemId: string,
  pageSelection: number[] | null,
) {
  return apiRequest<{ ok: boolean }>(`/api/personal-binders/items/${itemId}`, {
    method: 'PATCH',
    token: auth(token),
    body: JSON.stringify({ pageSelection }),
  })
}

export function deletePersonalBinderItem(token: string | null, itemId: string) {
  return apiRequest<{ ok: boolean }>(`/api/personal-binders/items/${itemId}`, {
    method: 'DELETE',
    token: auth(token),
  })
}

export function reorderPersonalBinderItems(
  token: string | null,
  sectionId: string,
  itemIds: string[],
) {
  return apiRequest<{ ok: boolean }>(
    `/api/personal-binders/sections/${sectionId}/items/reorder`,
    {
      method: 'PUT',
      token: auth(token),
      body: JSON.stringify({ itemIds }),
    },
  )
}
