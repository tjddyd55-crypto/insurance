import { listCompanyDirectory } from '../../company-registry/api/companyRegistryApi'
import { buildNewsletterContextFromCompany, isNewsletterInCompanyScope } from '../lib/insurerNewsCompanyScope'
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

/**
 * 원수사 담당자: 디렉터리에서 본인 company_id 행을 조회한 뒤, 동일 GA·동일 원수사 소식지만 반환.
 * TODO: GET /api/.../newsletters?companyId= 로 대체 시에도 서버에서 company_id 스코프 강제.
 */
export async function getNewslettersForInsurerManagerCompany(
  token: string,
  gaCode: string,
  companyMasterId: number,
): Promise<NewsletterItem[]> {
  const rows = await listCompanyDirectory(token)
  const entry = rows.find((r) => r.id === companyMasterId)
  if (!entry) {
    return []
  }
  const published = mockNewslettersPublishedForGa(gaCode)
  const scoped = published.filter((n) => isNewsletterInCompanyScope(n, entry, gaCode))
  return sortByPublishedDesc(scoped).map(toNewsletterItem)
}

export async function getNewsletterDetailForInsurerManager(
  token: string,
  gaCode: string,
  companyMasterId: number,
  newsletterId: string,
): Promise<NewsletterDetail | null> {
  const rows = await listCompanyDirectory(token)
  const entry = rows.find((r) => r.id === companyMasterId)
  if (!entry) {
    return null
  }
  const row = mockNewslettersPublishedForGa(gaCode).find((n) => n.id === newsletterId)
  if (!row || !isNewsletterInCompanyScope(row, entry, gaCode)) {
    return null
  }
  return row
}

/** 업로드 폼용 — 로그인 세션 company_id 에 맞는 발행 컨텍스트 */
export async function resolveInsurerManagerPublishContext(
  token: string,
  gaCode: string,
  companyMasterId: number,
): Promise<
  | { gaCode: string; insurerCode: string; insurerName: string; insurerSlug: string }
  | { error: string }
> {
  const rows = await listCompanyDirectory(token)
  const entry = rows.find((r) => r.id === companyMasterId)
  if (!entry) {
    return { error: '소속 원수사 정보를 찾을 수 없습니다. GA 관리자에게 문의해 주세요.' }
  }
  return buildNewsletterContextFromCompany(gaCode, entry)
}
