/**
 * GA 테넌트 공통 메뉴. 확장 시 GA_CUSTOM_MENU에 GA 코드를 추가하거나
 * 추후 DB 피처 플래그로 대체할 수 있습니다.
 */

export type GaTenantMenuItem = { label: string; path: string }

/** 모든 GA에 공통 */
export const BASE_GA_MENU: GaTenantMenuItem[] = [
  { label: '고객 관리', path: '/customers?mode=list' },
  { label: '원수사 연락처', path: '/contacts' },
  { label: '원수사 소식지', path: '/portal/newsletters' },
]

/**
 * GA 코드(대문자)별 추가 메뉴.
 * 최종: [...BASE_GA_MENU, ...(GA_CUSTOM_MENU[code] ?? [])]
 */
export const GA_CUSTOM_MENU: Record<string, GaTenantMenuItem[]> = {
  YJASSET: [{ label: '자동차 신청서', path: '/application' }],
}

/** GA 담당자(관리·스태프)만 노출 — 원수사 연락처는 GA 공용 데이터 편집 */
export const GA_STAFF_EXTRA_MENU: GaTenantMenuItem[] = [
  { label: '원수사 연락처 관리', path: '/contacts/manage' },
  { label: '원수사 소식지 관리', path: '/portal/insurer-news/login' },
]

export function normalizeGaMenuCode(raw: string | undefined): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
}

/** menu = BASE_GA_MENU + (GA_CUSTOM_MENU[ga_code] || []) */
export function buildGaTenantMenu(gaCode: string | undefined): GaTenantMenuItem[] {
  const code = normalizeGaMenuCode(gaCode)
  const extra = code ? (GA_CUSTOM_MENU[code] ?? []) : []
  return [...BASE_GA_MENU, ...extra]
}

/**
 * GA_CUSTOM_MENU에 자동차 신청 허브(`/application`)가 포함된 GA인지.
 * `/application`, `/my-forms`, `/form/*` 라우트 가드에 사용합니다.
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
