import { apiRequest } from '../../../lib/apiClient'
import type { NewsletterDetail, NewsletterItem, NewsletterSourceKind } from '../types'
import { getDynamicNewsletterBoardDetail, getNewsletterDetail } from './insurerNews.service'

export type NewsletterUserFolder = {
  id: string
  name: string
  count: number
  newsletterIds: string[]
  createdAt?: string
  updatedAt?: string
}

export type NewsletterCollections = {
  folders: NewsletterUserFolder[]
  favoriteNewsletterIds: string[]
}

export type NewsletterBinderImportResult = {
  newsletterId: string
  ok: boolean
  message?: string
  materialId?: string
  itemId?: string
  existing?: boolean
  reusedMaterial?: boolean
  pageCount?: number
  warnings?: string[]
}

export type NewsletterBinderImportResponse = {
  sectionId: string
  binderId: string
  succeeded: number
  failed: number
  results: NewsletterBinderImportResult[]
}

function auth(token: string | null | undefined) {
  if (!token?.trim()) throw new Error('로그인이 필요합니다.')
  return token
}

const json = (body: unknown) => JSON.stringify(body)

export function fetchNewsletterCollections(token: string | null | undefined) {
  return apiRequest<NewsletterCollections>('/api/newsletter-collections', { token: auth(token) })
}

export function createNewsletterFolder(token: string | null | undefined, name: string) {
  return apiRequest<NewsletterUserFolder>('/api/newsletter-collections/folders', {
    method: 'POST',
    token: auth(token),
    body: json({ name }),
  })
}

export function renameNewsletterFolder(token: string | null | undefined, folderId: string, name: string) {
  return apiRequest<NewsletterUserFolder>(`/api/newsletter-collections/folders/${encodeURIComponent(folderId)}`, {
    method: 'PATCH',
    token: auth(token),
    body: json({ name }),
  })
}

export function deleteNewsletterFolder(token: string | null | undefined, folderId: string) {
  return apiRequest<{ ok: boolean }>(`/api/newsletter-collections/folders/${encodeURIComponent(folderId)}`, {
    method: 'DELETE',
    token: auth(token),
  })
}

export function addNewslettersToFolder(
  token: string | null | undefined,
  folderId: string,
  newsletterIds: string[],
) {
  return apiRequest<{ added: string[]; duplicates: string[]; rejected: string[] }>(
    `/api/newsletter-collections/folders/${encodeURIComponent(folderId)}/items`,
    { method: 'POST', token: auth(token), body: json({ newsletterIds }) },
  )
}

export function removeNewsletterFromFolder(
  token: string | null | undefined,
  folderId: string,
  newsletterId: string,
) {
  return apiRequest<{ ok: boolean }>(
    `/api/newsletter-collections/folders/${encodeURIComponent(folderId)}/items/${encodeURIComponent(newsletterId)}`,
    { method: 'DELETE', token: auth(token) },
  )
}

export function setNewsletterFavorite(
  token: string | null | undefined,
  newsletterId: string,
  favorite: boolean,
) {
  return apiRequest<{ favorite: boolean }>(
    `/api/newsletter-collections/favorites/${encodeURIComponent(newsletterId)}`,
    { method: favorite ? 'PUT' : 'DELETE', token: auth(token) },
  )
}

export function importNewslettersToBinder(
  token: string | null | undefined,
  sectionId: string,
  newsletterIds: string[],
) {
  return apiRequest<NewsletterBinderImportResponse>('/api/newsletter-collections/binder-import', {
    method: 'POST',
    token: auth(token),
    body: json({ sectionId, newsletterIds }),
  })
}

/* ───────── t299: 소식지 선택기 공통 소스 (원수사 · GA · 공용) ───────── */

export function fetchNewsletterPickerSources(token: string | null | undefined) {
  return apiRequest<{ newsletters: NewsletterItem[] }>('/api/insurer-news/picker-sources', {
    token: auth(token),
  }).then((r) => r.newsletters ?? [])
}

/** 유형에 맞는 서버 상세 경로로 읽는다 (각 경로가 원본 열람 권한을 다시 확인). */
export async function loadNewsletterSourceDetail(
  item: Pick<NewsletterItem, 'id' | 'sourceKind' | 'boardSlug' | 'boardId'>,
  gaCode: string,
  token: string | null | undefined,
): Promise<NewsletterDetail | null> {
  if ((item.sourceKind === 'GA' || item.sourceKind === 'PUBLIC') && item.boardSlug) {
    return getDynamicNewsletterBoardDetail(item.boardSlug, item.id, token, item.boardId)
  }
  return getNewsletterDetail(gaCode, item.id, token, { channel: 'INSURER' })
}

export const NEWSLETTER_SOURCE_KIND_LABEL: Record<NewsletterSourceKind, string> = {
  INSURER: '원수사',
  GA: 'GA',
  PUBLIC: '공용',
}
