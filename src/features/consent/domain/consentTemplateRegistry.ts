/**
 * consent_templates 조회 조건: ga_id + insurance_company_id
 * (API 연동 전 mock 레지스트리 — 동일 보험사라도 GA별로 다른 템플릿 ID)
 */

/** UI·로그인 세션에 GA가 없을 때 사용하는 임시 기본값 */
export const MOCK_CONSENT_GA_ID = 1

export function getConsentGaIdForUser(user: { gaId?: number } | null | undefined): number {
  if (user?.gaId != null && Number.isFinite(user.gaId)) {
    return user.gaId
  }
  return MOCK_CONSENT_GA_ID
}

export interface ConsentTemplateRow {
  gaId: number
  insuranceCompanyId: string
  consentTemplateId: string
  /** 향후 GA별 템플릿 버전·팩스번호 등 확장 시 메타 */
  version?: string
}

/** DB 시드( consentSeedData.js )와 동일한 UUID — 로컬 GET /consent/templates 없을 때 폴백 */
const MOCK_CONSENT_TEMPLATE_ROWS: ConsentTemplateRow[] = [
  {
    gaId: 1,
    insuranceCompanyId: 'life-samsung',
    consentTemplateId: 'a1000000-0000-4000-8000-000000000001',
    version: '1',
  },
  {
    gaId: 1,
    insuranceCompanyId: 'life-hanwha',
    consentTemplateId: 'a1000000-0000-4000-8000-000000000002',
    version: '1',
  },
  {
    gaId: 1,
    insuranceCompanyId: 'life-kyobo',
    consentTemplateId: 'a1000000-0000-4000-8000-000000000003',
    version: '1',
  },
  {
    gaId: 1,
    insuranceCompanyId: 'nonlife-samsung',
    consentTemplateId: 'a1000000-0000-4000-8000-000000000004',
    version: '1',
  },
  {
    gaId: 1,
    insuranceCompanyId: 'nonlife-db',
    consentTemplateId: 'a1000000-0000-4000-8000-000000000005',
    version: '1',
  },
  {
    gaId: 1,
    insuranceCompanyId: 'nonlife-meritz',
    consentTemplateId: 'a1000000-0000-4000-8000-000000000006',
    version: '1',
  },
  {
    gaId: 2,
    insuranceCompanyId: 'life-samsung',
    consentTemplateId: 'b2000000-0000-4000-8000-000000000001',
    version: '1',
  },
  {
    gaId: 2,
    insuranceCompanyId: 'life-hanwha',
    consentTemplateId: 'b2000000-0000-4000-8000-000000000002',
    version: '1',
  },
]

const templateByGaAndCompany = new Map<string, ConsentTemplateRow>()
for (const row of MOCK_CONSENT_TEMPLATE_ROWS) {
  templateByGaAndCompany.set(`${row.gaId}::${row.insuranceCompanyId}`, row)
}

/**
 * 향후: API `GET /consent-templates?ga_id=&insurance_company_id=` 대체
 */
export function resolveConsentTemplateId(gaId: number, insuranceCompanyId: string): string {
  const hit = templateByGaAndCompany.get(`${gaId}::${insuranceCompanyId}`)
  if (hit) {
    return hit.consentTemplateId
  }
  return `ct-unresolved-ga${gaId}-${insuranceCompanyId}`
}

export function getMockTemplateRow(
  gaId: number,
  insuranceCompanyId: string,
): ConsentTemplateRow | undefined {
  return templateByGaAndCompany.get(`${gaId}::${insuranceCompanyId}`)
}
