import { mockInsurersForGa } from '../mock/insurers'
import { mockNewslettersPublishedForGa, toNewsletterItem } from '../mock/newsletters'
import type { InsurerSummary, NewsletterDetail, NewsletterItem } from '../types'

function sortByPublishedDesc<T extends { publishedAt: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}

/** TODO(insurer-news): GET /api/.../newsletters/recent?ga= */
export async function getRecentNewslettersByGa(gaCode: string, limit = 8): Promise<NewsletterItem[]> {
  const rows = sortByPublishedDesc(mockNewslettersPublishedForGa(gaCode)).map(toNewsletterItem)
  return rows.slice(0, limit)
}

/** TODO(insurer-news): GET 목록 API */
export async function getNewslettersByInsurer(
  gaCode: string,
  insurerSlug: string,
): Promise<NewsletterItem[]> {
  const rows = mockNewslettersPublishedForGa(gaCode).filter(
    (n) => n.insurerSlug === insurerSlug.trim().toLowerCase(),
  )
  return sortByPublishedDesc(rows).map(toNewsletterItem)
}

/** TODO(insurer-news): GET 상세 API */
export async function getNewsletterDetail(gaCode: string, newsletterId: string): Promise<NewsletterDetail | null> {
  const row = mockNewslettersPublishedForGa(gaCode).find((n) => n.id === newsletterId)
  return row ?? null
}

/** TODO(insurer-news): GET /insurers */
export async function getInsurersForGa(gaCode: string): Promise<InsurerSummary[]> {
  return mockInsurersForGa(gaCode).sort((a, b) => a.insurerName.localeCompare(b.insurerName, 'ko'))
}

/** 검색·필터는 클라이언트에서 목록 받아 처리 — 추후 서버 검색으로 대체 */
export async function getAllPublishedForGa(gaCode: string): Promise<NewsletterItem[]> {
  return sortByPublishedDesc(mockNewslettersPublishedForGa(gaCode)).map(toNewsletterItem)
}

/** TODO(insurer-news): 파일별 presign · 완료 콜백 — R2 연결 시 구현 */
export async function uploadNewsletterAttachments(): Promise<never> {
  throw new Error('TODO(insurer-news): uploadNewsletterAttachments — presign 파이프라인')
}
