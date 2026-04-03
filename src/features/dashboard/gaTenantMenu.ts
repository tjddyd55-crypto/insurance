/**
 * GA 테넌트(USER / GA_ADMIN / GA_STAFF) 메인 메뉴.
 * 최종 확정: 원수사 연락처 관리 + 원수사 담당자 관리 만 노출.
 */

export type GaTenantMenuItem = { label: string; path: string }

/** GA 소속 계정 메뉴 — 항상 이 2개만 */
export const GA_TENANT_ESSENTIAL_MENU: GaTenantMenuItem[] = [
  { label: '원수사 연락처 관리', path: '/contacts/manage' },
  { label: '원수사 담당자 관리', path: '/insurer-managers' },
]

/** @deprecated 호환용 — 내용은 GA_TENANT_ESSENTIAL_MENU 와 동일 */
export const BASE_GA_MENU: GaTenantMenuItem[] = []

/**
 * 대시보드 메뉴에는 포함하지 않음(GA_TENANT_ESSENTIAL_MENU 만 노출).
 * 자동차 신청 라우트 가드(GaCarInsuranceRoute)용으로만 참조.
 */
export const GA_CUSTOM_MENU: Record<string, GaTenantMenuItem[]> = {
  YJASSET: [{ label: '자동차 신청서', path: '/application' }],
}

/** @deprecated 빈 배열 — 메뉴는 GA_TENANT_ESSENTIAL_MENU 단일 소스 */
export const GA_STAFF_EXTRA_MENU: GaTenantMenuItem[] = []

export function normalizeGaMenuCode(raw: string | undefined): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
}

/** @deprecated GA_TENANT_ESSENTIAL_MENU 사용 권장 */
export function buildGaTenantMenu(_gaCode?: string | undefined): GaTenantMenuItem[] {
  void _gaCode
  return [...GA_TENANT_ESSENTIAL_MENU]
}

/**
 * GA_CUSTOM_MENU에 자동차 신청 허브(`/application`)가 포함된 GA인지.
 * 대시보드 메뉴와는 별개(메뉴는 2개 고정).
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
