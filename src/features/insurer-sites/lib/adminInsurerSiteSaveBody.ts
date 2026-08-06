/**
 * 관리자 보험사 설계사이트 저장 payload.
 * claimUrl은 UI 미노출 정책상 포함하지 않는다(기존 DB 값 보존).
 */
export type AdminInsurerSiteSaveBodyInput = {
  category: 'non_life' | 'life'
  name: string
  logoPath: string
  salesUrl: string
  homepageUrl: string
  disclosureUrl: string
  sortOrder: string | number
  isActive: boolean
}

export function buildAdminInsurerSiteSaveBody(form: AdminInsurerSiteSaveBodyInput) {
  const sortOrder = Number(form.sortOrder)
  const sort = Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0
  return {
    category: form.category,
    name: form.name,
    logoPath: String(form.logoPath ?? '').trim(),
    salesUrl: form.salesUrl,
    homepageUrl: form.homepageUrl,
    disclosureUrl: form.disclosureUrl,
    sortOrder: sort,
    isActive: form.isActive,
  }
}
