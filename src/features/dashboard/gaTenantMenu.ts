/**
 * GA 테넌트 대시보드 메뉴(USER / GA_ADMIN).
 * GA_STAFF 는 GA_STAFF_MENU 단독(원수사 관리 전용).
 * INSURER_MANAGER 는 INSURER_MANAGER_MENU 별도.
 */

export type GaTenantMenuItem = { label: string; path: string }

/** @deprecated 대시보드는 buildGaTenantDashboardMenu 사용 */
export const GA_TENANT_ESSENTIAL_MENU: GaTenantMenuItem[] = [
  { label: '고객관리', path: '/customers' },
  { label: '원수사 연락처 조회', path: '/insurance/contacts' },
  { label: '원수사 소식지', path: '/portal/newsletters' },
  { label: '추가기능 요청하기', path: '/feature-request' },
  { label: '계정 초기화', path: '/account/reset' },
]

/** 원수사 담당자 — 본인 회사 소식지 */
export const INSURER_MANAGER_MENU: GaTenantMenuItem[] = [
  { label: '원수사 소식지 조회', path: '/insurer/news' },
  { label: '원수사 소식지 업로드', path: '/insurer/news/upload' },
]

/** GA_STAFF 전용 — 원수사 관리만(다른 GA 메뉴와 merge 금지) */
export const GA_STAFF_MENU: GaTenantMenuItem[] = [
  { label: '원수사 연락처 관리', path: '/insurance/company-registry' },
  { label: '원수사 담당자 관리', path: '/insurer-managers' },
  { label: '추가기능 요청하기', path: '/feature-request' },
]

/** @deprecated 호환용 */
export const BASE_GA_MENU: GaTenantMenuItem[] = []

/**
 * 대시보드 GA 메뉴.
 * 자동차: 표시명「영진에셋」또는 GA_CUSTOM_MENU(YJASSET) — GaCarInsuranceRoute 와 동일하게 진입 가능하도록 맞춤.
 */
export function buildGaTenantDashboardMenu(
  gaCode: string | undefined,
  gaName: string | undefined,
  /** 일반 설계사(USER)에게만 프로필 메뉴 노출 */
  includeProfile = false,
): GaTenantMenuItem[] {
  const items: GaTenantMenuItem[] = [
    { label: '고객관리', path: '/customers' },
    { label: '원수사 연락처 조회', path: '/insurance/contacts' },
    { label: '원수사 소식지', path: '/portal/newsletters' },
  ]
  const carByName = String(gaName ?? '').trim() === '영진에셋'
  if (carByName || isCarInsuranceFeatureEnabledForGa(gaCode)) {
    items.push({ label: '자동차 신청서', path: '/application' })
  }
  items.push({ label: '추가기능 요청하기', path: '/feature-request' })
  if (includeProfile) {
    items.push({ label: '프로필', path: '/profile' })
  }
  items.push({ label: '계정 초기화', path: '/account/reset' })
  return items
}

/**
 * 대시보드와 별개 — 자동차 신청 허브(GaCarInsuranceRoute) 판별용.
 * 코드 YJASSET 기준(영진에셋 테넌트).
 */
export const GA_CUSTOM_MENU: Record<string, GaTenantMenuItem[]> = {
  YJASSET: [{ label: '자동차 신청서', path: '/application' }],
}

export function normalizeGaMenuCode(raw: string | undefined): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
}

/** @deprecated buildGaTenantDashboardMenu 사용 */
export function buildGaTenantMenu(gaCode?: string | undefined, gaName?: string | undefined): GaTenantMenuItem[] {
  return buildGaTenantDashboardMenu(gaCode, gaName)
}

/**
 * GA_CUSTOM_MENU에 자동차 신청 허브(`/application`)가 포함된 GA인지.
 */
export function isCarInsuranceFeatureEnabledForGa(gaCode: string | undefined): boolean {
  const code = normalizeGaMenuCode(gaCode)
  if (!code) {
    return false
  }
  const extra = GA_CUSTOM_MENU[code]
  if (!extra?.length) {
    return false
  }
  return extra.some((item) => {
    const base = item.path.split('?')[0]
    return base === '/application' || base.startsWith('/application/')
  })
}
