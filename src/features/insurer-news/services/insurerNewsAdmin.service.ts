import {
  deleteNewsletterFromStore,
  mockNewslettersAllForAdmin,
  toNewsletterItem,
  upsertNewsletterInStore,
} from '../mock/newsletters'
import type { NewsletterDetail, NewsletterItem } from '../types'

function sortDesc(rows: NewsletterDetail[]): NewsletterDetail[] {
  return [...rows].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}

/** TODO(insurer-news): 관리자 GA+원수사 스코프 JWT */
export async function getAdminNewsletters(gaCode: string, insurerCode: string): Promise<NewsletterItem[]> {
  return sortDesc(mockNewslettersAllForAdmin(gaCode, insurerCode)).map(toNewsletterItem)
}

/** TODO(insurer-news): GET 상세 (권한 검증) */
export async function getAdminNewsletterDetail(
  gaCode: string,
  insurerCode: string,
  id: string,
): Promise<NewsletterDetail | null> {
  const row = mockNewslettersAllForAdmin(gaCode, insurerCode).find((n) => n.id === id)
  return row ?? null
}

/** TODO(insurer-news): POST + 업로드 파이프라인 */
export async function createNewsletter(draft: NewsletterDetail): Promise<NewsletterDetail> {
  upsertNewsletterInStore(draft)
  return draft
}

/** TODO(insurer-news): PATCH */
export async function updateNewsletter(draft: NewsletterDetail): Promise<NewsletterDetail> {
  upsertNewsletterInStore(draft)
  return draft
}

/** TODO(insurer-news): DELETE (soft delete 권장) */
export async function deleteNewsletter(id: string): Promise<void> {
  deleteNewsletterFromStore(id)
}

/** TODO(insurer-news): presign 루프 — R2 연결 시 구현 */
export async function uploadNewsletterAttachments(): Promise<never> {
  throw new Error('TODO(insurer-news): R2 presign 업로드 연결')
}
