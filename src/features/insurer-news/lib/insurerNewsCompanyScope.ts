import type { CompanyDirectoryEntry } from '../../company-registry/domain/types'
import { mockInsurersForGa } from '../mock/insurers'
import type { NewsletterDetail } from '../types'

function slugifyInsurerName(name: string): string {
  const t = name.trim().toLowerCase().replace(/\s+/g, '-')
  const stripped = t.replace(/[^\w\u3131-\u318e\uac00-\ud7a3-]/g, '')
  return stripped.slice(0, 48) || 'insurer'
}

/**
 * 디렉터리 행(company_id) → 소식지 mock/저장에 쓰는 GA+원수사 컨텍스트.
 * 서버 API 연동 시 동일 스코프 규칙으로 교체.
 */
export function buildNewsletterContextFromCompany(
  gaCode: string,
  entry: CompanyDirectoryEntry,
): { gaCode: string; insurerCode: string; insurerName: string; insurerSlug: string } {
  const g = gaCode.trim().toUpperCase()
  const insurers = mockInsurersForGa(g)
  const exactName = insurers.find((x) => x.insurerName.trim() === entry.name.trim())
  if (exactName) {
    return {
      gaCode: g,
      insurerCode: exactName.insurerCode,
      insurerName: exactName.insurerName,
      insurerSlug: exactName.insurerSlug,
    }
  }
  const codeUpper = entry.companyCode.trim().toUpperCase()
  const byShortCode = insurers.find((x) => x.insurerCode.toUpperCase() === codeUpper)
  if (byShortCode) {
    return {
      gaCode: g,
      insurerCode: byShortCode.insurerCode,
      insurerName: byShortCode.insurerName,
      insurerSlug: byShortCode.insurerSlug,
    }
  }
  return {
    gaCode: g,
    insurerCode: codeUpper.slice(0, 8) || 'CUSTOM',
    insurerName: entry.name.trim(),
    insurerSlug: slugifyInsurerName(entry.name),
  }
}

/** 목록·상세: 로그인 원수사(company 마스터)에 속한 소식지만 */
export function isNewsletterInCompanyScope(
  n: NewsletterDetail,
  entry: CompanyDirectoryEntry,
  gaCode: string,
): boolean {
  if (n.gaCode !== gaCode.trim().toUpperCase()) {
    return false
  }
  const ctx = buildNewsletterContextFromCompany(gaCode, entry)
  if (n.insurerCode === ctx.insurerCode && n.insurerSlug === ctx.insurerSlug) {
    return true
  }
  if (n.insurerName.trim() === entry.name.trim()) {
    return true
  }
  return false
}
