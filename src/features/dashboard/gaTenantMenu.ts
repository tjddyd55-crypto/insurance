/**
 * GA 테넌트 대시보드 메뉴(USER / GA_ADMIN).
 * GA_STAFF 는 GA_STAFF_MENU 단독(원수사 관리 전용).
 * INSURER_MANAGER 는 INSURER_MANAGER_MENU 별도.
 */

export type GaTenantMenuItem = { label: string; path: string }

/** 대시보드 전용 — 구분선 포함 */
export type GaTenantDashboardMenuEntry =
  | {
      type: 'link'
      label: string
      path: string
      disabled?: boolean
      /** true: 페이지 이동 없이 준비중 안내만 (path는 플레이스홀더) */
      preparing?: boolean
    }
  | { type: 'divider' }

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

/** 손해사정사 담당자 — 본인 회사 뉴스 */
export const LOSS_ADJUSTER_MENU: GaTenantMenuItem[] = [
  { label: '손해사정사 뉴스 조회', path: '/adjuster/news' },
  { label: '손해사정사 뉴스 업로드', path: '/adjuster/news/upload' },
]

/** GA_STAFF 전용 — 원수사 관리만(다른 GA 메뉴와 merge 금지) */
export const GA_STAFF_MENU: GaTenantMenuItem[] = [
  { label: '원수사 연락처 관리', path: '/insurance/company-registry' },
  { label: '원수사 담당자 관리', path: '/insurer-managers' },
  { label: '손해사정사 계정 관리', path: '/loss-adjusters' },
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
): GaTenantDashboardMenuEntry[] {
  const items: GaTenantDashboardMenuEntry[] = [
    { type: 'link', label: '내 저장공간', path: '/storage' },
    { type: 'link', label: '고객관리', path: '/customers' },
    { type: 'link', label: '원수사 연락처', path: '/insurance/contacts' },
    { type: 'link', label: '원수사 소식지', path: '/portal/newsletters' },
    { type: 'link', label: '손해사정사 소식지', path: '/portal/adjuster-news' },
    { type: 'divider' },
  ]
  const carByName = String(gaName ?? '').trim() === '영진에셋'
  if (carByName || isCarInsuranceFeatureEnabledForGa(gaCode)) {
    items.push({ type: 'link', label: '자동차신청서', path: '/application' })
    items.push({
      type: 'link',
      label: '다이렉트 자동차',
      path: '#',
      preparing: true,
    })
  }
  items.push({
    type: 'link',
    label: '기타 신청서(개발중)',
    path: '/feature-request',
    disabled: true,
  })
  items.push({ type: 'link', label: '청구 요청', path: '/claim-requests' })
  items.push({ type: 'divider' })
  items.push(
    { type: 'link', label: '팀원리스트', path: '/team/members' },
    { type: 'link', label: '팀 게시판', path: '/team/posts' },
    { type: 'link', label: '팀 자료', path: '/team/files' },
  )
  items.push({ type: 'divider' })
  items.push(
    { type: 'link', label: '문의, 요청', path: '/feature-request' },
    { type: 'link', label: '내정보관리', path: '/profile' },
  )
  return items
}

/**
 * 세션(= 로그인 유저)에 해당하는 앱 전역 메뉴.
 *
 * ## 단일 진실 원천
 *
 * 이 함수는 세 호출처에서 공유된다. 호출처 세 곳이 **정확히 같은 메뉴 리스트** 를
 * 반환하도록 보장해서 "대시보드 vs 햄버거 드로어 vs PC 사이드바" 사이의 메뉴
 * 불일치를 구조적으로 제거한다.
 *
 *   1. `DashboardPage`              — 메뉴 카드 그리드 (로그인 직후 홈 화면)
 *   2. `AppWorkspaceLayoutMobileShell` — 모바일 햄버거 드로어
 *   3. `AppWorkspaceLayoutPCShell`     — PC 좌측 사이드바
 *
 * 과거엔 세 곳이 각자 유사한 로직을 직접 구현하고 있어서 "대시보드에는 있는데
 * 햄버거에는 없다" 같은 불일치가 쉽게 발생했다. 메뉴가 늘어나거나 정렬이
 * 바뀔 때 모든 호출처가 자동 동기화되도록 이 함수로 통합한다.
 *
 * ## 옵션
 *
 *  - `includeMemo`: "메모" 항목(`/memo`) 주입 여부.
 *      - Mobile 드로어 / Mobile 대시보드: `true` (우측 상시 메모 패널이 없음).
 *      - PC 사이드바 / PC 대시보드:       `false` (우측 메모 패널 상시 → 중복 회피).
 *
 *  - `teamMenuManageVisible`: 팀 소유자 여부.
 *      - `true` 면 `/team/files` 바로 다음에 "팀 관리" 를 주입.
 *      - 자리를 고정해 사이드바·대시보드·드로어 모두 같은 위치에 나타나게 한다.
 *
 * ## 반환 타입
 *
 * `GaTenantDashboardMenuEntry[]` — divider 포함. 렌더 측이 divider 를 표시할지
 * 여부를 결정한다 (예: 모바일 드로어는 divider 를 일괄 무시).
 */
export type AppMenuBuildOptions = {
  includeMemo?: boolean
  teamMenuManageVisible?: boolean
}

const AUDIT_LOG_ENTRY: GaTenantMenuItem = { label: '보안 감사 로그', path: '/admin/audit-logs' }

const SUPER_ADMIN_BASE: GaTenantMenuItem[] = [
  { label: 'GA 관리', path: '/admin/ga' },
  { label: '담당자 관리', path: '/admin/delegates' },
  { label: '유저 관리', path: '/admin/users' },
  { label: '운영 통계', path: '/admin/analytics' },
  { label: '기능 요청 관리', path: '/internal/admin/feature-requests' },
]

function itemsToEntries(items: GaTenantMenuItem[]): GaTenantDashboardMenuEntry[] {
  return items.map((item) => ({ type: 'link' as const, label: item.label, path: item.path }))
}

export function buildAppMenuForSession(
  role: string | undefined,
  gaCode: string | undefined,
  gaName: string | undefined,
  options: AppMenuBuildOptions = {},
): GaTenantDashboardMenuEntry[] {
  const { includeMemo = false, teamMenuManageVisible = false } = options

  const base: GaTenantDashboardMenuEntry[] = (() => {
    if (role === 'SUPER_ADMIN') {
      return [
        ...itemsToEntries(SUPER_ADMIN_BASE),
        { type: 'link', label: AUDIT_LOG_ENTRY.label, path: AUDIT_LOG_ENTRY.path },
      ]
    }
    if (role === 'INSURER_MANAGER') {
      return itemsToEntries(INSURER_MANAGER_MENU)
    }
    if (role === 'LOSS_ADJUSTER') {
      return itemsToEntries(LOSS_ADJUSTER_MENU)
    }
    if (role === 'GA_STAFF') {
      return itemsToEntries(GA_STAFF_MENU)
    }
    if (role === 'GA_ADMIN' || role === 'USER') {
      const entries = buildGaTenantDashboardMenu(gaCode, gaName)
      if (role === 'GA_ADMIN') {
        entries.push(
          { type: 'divider' },
          { type: 'link', label: AUDIT_LOG_ENTRY.label, path: AUDIT_LOG_ENTRY.path },
        )
      }
      return entries
    }
    return []
  })()

  // 팀 관리 주입: `/team/files` 바로 다음 자리에 고정.
  let withTeam = base
  if (teamMenuManageVisible) {
    const filesIdx = base.findIndex((entry) => entry.type === 'link' && entry.path === '/team/files')
    const teamManageEntry: GaTenantDashboardMenuEntry = {
      type: 'link',
      label: '팀 관리',
      path: '/team/manage',
    }
    if (filesIdx >= 0) {
      withTeam = [...base.slice(0, filesIdx + 1), teamManageEntry, ...base.slice(filesIdx + 1)]
    } else {
      withTeam = [...base, teamManageEntry]
    }
  }

  // 메모 주입: 항상 리스트 맨 끝.
  if (!includeMemo) {
    return withTeam
  }
  const memoEntry: GaTenantDashboardMenuEntry = { type: 'link', label: '메모', path: '/memo' }
  return [...withTeam, memoEntry]
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
  return buildGaTenantDashboardMenu(gaCode, gaName).flatMap((e) =>
    e.type === 'divider'
      ? []
      : [
          {
            label: e.label,
            path: e.disabled || e.preparing ? '#' : e.path,
          },
        ],
  )
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

/** 대시보드·워크스페이스와 동일: 영진에셋(이름) 또는 GA_CUSTOM_MENU 기준 자동차 허브 노출 */
export function isGaCarInsuranceHubEnabled(gaCode: string | undefined, gaName: string | undefined): boolean {
  const carByName = String(gaName ?? '').trim() === '영진에셋'
  return carByName || isCarInsuranceFeatureEnabledForGa(gaCode)
}
