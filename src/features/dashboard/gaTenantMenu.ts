/**
 * GA 테넌트 대시보드 메뉴(USER / GA_ADMIN).
 * GA_STAFF 는 GA_STAFF_MENU 단독(원수사 관리 전용).
 * INSURER_MANAGER 는 INSURER_MANAGER_MENU 별도.
 */

import { isAllowedForExpiredFrontend } from '../subscription/expiredAllowlist'
import { canAccessContractSignatureAdminConsole } from '../contracts/testConsole/contractSignatureTestConsoleFlags'
import {
  canUseInsuranceClaimAdminRoutes,
  canUseInsuranceClaimUserRoutes,
  canUseNewsletterBoardAdminRoutes,
  canUsePdfTemplateAdminRoutes,
} from '../auth/roleGuards'
import { isPublicGeneralAccount } from '../auth/generalGa'
import { applyPublicAccountMenuPathRestrictions } from '../auth/publicAccountRestrictedRoutes'

export type GaTenantMenuItem = { label: string; path: string }

export type DynamicNewsletterBoardMenuItem = {
  label: string
  slug: string
}

/**
 * 대시보드·사이드바·드로어 공용 메뉴 엔트리.
 *
 * 엔트리 종류:
 *  - `link`     : 실제 이동 가능한 메뉴 항목. `disabled`/`preparing` 조합으로 비활성도 표현.
 *                 `badge` 는 우측에 붙는 짧은 라벨(예: "개발중") — UI 토큰일 뿐, 동작 분기 아님.
 *  - `divider`  : 텍스트 없는 얇은 구분선. 호출처별로 렌더 생략 가능(예: 모바일 드로어 무시).
 *  - `section`  : **텍스트 라벨 있는 그룹 헤더**. "고객관리 / 소식지 / 팀관리 …" 같은
 *                 카테고리를 사용자에게 명시적으로 보여줄 때 사용.
 *                 (divider 와 분리한 이유: 의미가 달라 호환성·UI 선택 폭이 더 넓어진다.)
 */
export type GaTenantDashboardMenuEntry =
  | {
      type: 'link'
      label: string
      path: string
      disabled?: boolean
      /** true: 페이지 이동 없이 준비중 안내만 (path는 플레이스홀더) */
      preparing?: boolean
      /** "개발중" 같이 항목 옆에 표시되는 짧은 배지 라벨(정보 전용). */
      badge?: string
    }
  | { type: 'divider' }
  | { type: 'section'; label: string }

/** @deprecated 대시보드는 buildGaTenantDashboardMenu 사용 */
export const GA_TENANT_ESSENTIAL_MENU: GaTenantMenuItem[] = [
  { label: '고객관리', path: '/customers' },
  { label: '원수사 연락처 조회', path: '/insurance/contacts' },
  { label: '원수사 소식지', path: '/portal/newsletters' },
  { label: '추가기능 요청하기', path: '/feature-request' },
  { label: '계정 초기화', path: '/account/reset' },
]

/** 원수사 담당자(INSURER_MANAGER) — 소식지 전용. 설계사 업무 메뉴 미포함 */
export const INSURER_MANAGER_MENU: GaTenantMenuItem[] = [
  { label: '원수사 소식지 조회', path: '/insurer/news' },
  { label: '원수사 소식지 업로드', path: '/insurer/news/upload' },
]

/** 손해사정사 담당자(LOSS_ADJUSTER) — 소식지 전용. 설계사 업무 메뉴 미포함 */
export const LOSS_ADJUSTER_MENU: GaTenantMenuItem[] = [
  { label: '손해사정사 뉴스 조회', path: '/adjuster/news' },
  { label: '손해사정사 뉴스 업로드', path: '/adjuster/news/upload' },
]

/** GA_STAFF 전용 — 원수사 관리만(다른 GA 메뉴와 merge 금지) */
export const GA_STAFF_MENU: GaTenantMenuItem[] = [
  { label: '원수사 연락처 관리', path: '/insurance/company-registry' },
  { label: '원수사 담당자 관리', path: '/insurer-managers' },
  { label: '손해사정사 계정 관리', path: '/loss-adjusters' },
  { label: '보험사 설계사이트', path: '/insurance/insurer-sites' },
  { label: '추가기능 요청하기', path: '/feature-request' },
]

/** @deprecated 호환용 */
export const BASE_GA_MENU: GaTenantMenuItem[] = []

/**
 * 대시보드 GA 메뉴 (USER / GA_ADMIN).
 *
 * ## 구조 — 카테고리 섹션 (USER/GA_ADMIN 공통)
 *
 *   1. 할일 및 알림 · 오늘의 TA · 할일 · 메모 · 알림
 *   2. 고객관리 · 고객리스트 · 고객소식지 · 청구관리
 *   3. 소식지 · 원수사소식지 · 손해사정사 소식지 · 세무사 소식지(개발중 플레이스홀더, 요구 목록에 없어서도 기존 연결 유지)
 *   4. 신청서 · 신청서 작성 · 신청서 작성내역 · 렌트(사고대차)(개발중)
 *   5. 전자서명(USER 한정) · 전자서명 발송 · 전자서명 발송내역 — inject via buildGaTenantDashboardMenu 옵션
 *   6. 팀관리 · 팀원리스트 · 팀 게시판 · 팀 자료 · (팀 관리 — 오너만, `/team/files` 뒤 주입)
 *   7. 업무편의 · 원수사 연락처 · 설계사이트
 *   8. 내정보 · 내 저장공간 · 내정보관리 · 문의요청
 *   — 레거시 자동차 전용 허브(`/application` 메뉴 노출 등) 규칙 기존대로.
 *
 * ## 배지 / 비활성 정책
 *
 * "개발중" 으로 표기되는 항목은 `disabled: true` + `badge: '개발중'` 조합을 쓴다.
 *  - `disabled`: 클릭·네비게이션을 막는다 (렌더 측 책임).
 *  - `badge`   : UI 에 옆에 표기되는 라벨(정보 전용).
 *  - `preparing` 은 **사용하지 않는다** — 과거엔 "준비중 모달" 을 띄우는 용도였으나
 *    신규 정책은 "클릭 비활성 + 배지 표기" 로 통일(사용자 요청).
 *
 * ## 수정 가이드
 *
 *  - 새 메뉴는 해당 섹션 배열에 엔트리 추가 → 자동으로 모든 호출처에 반영된다.
 *  - 새 섹션 추가 시 `{ type: 'section', label }` 으로 시작해 하위 링크를 이어 붙인다.
 *  - 조건부 노출(예: 영진에셋 전용) 은 섹션 단위가 아닌 개별 링크 단위로 판단한다.
 *    섹션은 항상 노출하되, 내부 항목이 비어 보여도 "준비 중" 이 자연스럽게 드러나도록 한다.
 */
const DEV_BADGE = '개발중'

type BuildGaTenantDashboardMenuOptions = {
  /** USER 역할에게만 신청서 아래 「전자서명」 블록을 붙인다. */
  includeUserContractSignatures?: boolean
  /** USER 전용 — 청구관리·보험청구·고객소식지(청구 모듈) 노출 */
  includeInsuranceClaimFeatures?: boolean
  dynamicNewsletterBoards?: DynamicNewsletterBoardMenuItem[]
}

export function buildGaTenantDashboardMenu(
  gaCode: string | undefined,
  gaName: string | undefined,
  options: BuildGaTenantDashboardMenuOptions = {},
): GaTenantDashboardMenuEntry[] {
  const { includeUserContractSignatures = false, includeInsuranceClaimFeatures = false, dynamicNewsletterBoards = [] } =
    options

  void gaCode
  void gaName

  const applicationItems: GaTenantDashboardMenuEntry[] = [
    { type: 'link', label: '신청서 작성', path: '/application/documents' },
    { type: 'link', label: '신청서 작성내역', path: '/application/documents/history' },
    {
      type: 'link',
      label: '렌트(사고대차)',
      path: '#',
      disabled: true,
      badge: DEV_BADGE,
    },
  ]

  const userContractSignatures: GaTenantDashboardMenuEntry[] = [
    { type: 'section', label: '전자서명' },
    {
      type: 'link',
      label: CONTRACT_SIGNATURE_USER_SEND.label,
      path: CONTRACT_SIGNATURE_USER_SEND.path,
    },
    {
      type: 'link',
      label: CONTRACT_SIGNATURE_USER_HISTORY.label,
      path: CONTRACT_SIGNATURE_USER_HISTORY.path,
    },
  ]

  const customerManagementLinks: GaTenantDashboardMenuEntry[] = [
    { type: 'link', label: '고객리스트', path: '/customers' },
    { type: 'link', label: '고객 지도', path: '/customers/map' },
  ]
  if (includeInsuranceClaimFeatures) {
    customerManagementLinks.push(
      {
        type: 'link',
        label: '고객소식지',
        path: '/claim-requests?claimTab=news-all',
      },
      { type: 'link', label: '청구관리', path: '/claim-requests' },
    )
  }

  const insuranceClaimMenu: GaTenantDashboardMenuEntry[] = includeInsuranceClaimFeatures
    ? [
        { type: 'section', label: '보험청구' },
        { type: 'link', label: INSURANCE_CLAIM_USER_MENU.label, path: INSURANCE_CLAIM_USER_MENU.path },
      ]
    : []

  return [
    { type: 'section', label: '할일 및 알림' },
    { type: 'link', label: '오늘의 TA', path: '/ta-call' },
    { type: 'link', label: '할일', path: '/todos' },
    { type: 'link', label: '메모', path: '/memo' },
    { type: 'link', label: '알림', path: '/notifications' },

    { type: 'section', label: '고객관리' },
    ...customerManagementLinks,

    { type: 'section', label: '소식지' },
    { type: 'link', label: '원수사소식지', path: '/portal/newsletters' },
    { type: 'link', label: '손해사정사 소식지', path: '/portal/adjuster-news' },
    ...dynamicNewsletterBoards.map((board) => ({
      type: 'link' as const,
      label: board.label,
      path: `/portal/boards/${encodeURIComponent(board.slug)}`,
    })),

    { type: 'section', label: '신청서' },
    ...applicationItems,

    ...(includeUserContractSignatures ? userContractSignatures : []),

    ...insuranceClaimMenu,

    { type: 'section', label: '팀관리' },
    { type: 'link', label: '팀원리스트', path: '/team/members' },
    { type: 'link', label: '팀 게시판', path: '/team/posts' },
    { type: 'link', label: '팀 자료', path: '/team/files' },

    { type: 'section', label: '업무편의' },
    { type: 'link', label: '원수사 연락처', path: '/insurance/contacts' },
    { type: 'link', label: '계정관리', path: '/insurance/account-credentials' },
    { type: 'link', label: '설계사이트', path: '/insurance/insurer-sites' },

    { type: 'section', label: '내정보' },
    { type: 'link', label: '내 저장공간', path: '/storage' },
    { type: 'link', label: '내정보관리', path: '/profile' },
    { type: 'link', label: '문의요청', path: '/feature-request' },
  ]
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
  teamMenuManageVisible?: boolean
  dynamicNewsletterBoards?: DynamicNewsletterBoardMenuItem[]
  /**
   * 구독 만료(EXPIRED) 유저에게만 메뉴를 화이트리스트 정책으로 필터링한다.
   * EXPIRED_ALLOW_FRONTEND_PATHS 에 해당하지 않는 링크는 제거되고,
   * 결과적으로 고립된 divider 는 자동 정리된다.
   *
   * 서버의 enforceActiveSubscription 과 동일한 경계를 메뉴 레벨에서 선제적으로
   * 적용해 "보이는데 들어가면 403" 이라는 UX 불일치를 없앤다.
   */
  subscriptionExpired?: boolean
}

const AUDIT_LOG_ENTRY: GaTenantMenuItem = { label: '보안 감사 로그', path: '/admin/audit-logs' }

const CONTRACT_SIGNATURE_USER_SEND: GaTenantMenuItem = {
  label: '전자서명 발송',
  path: '/contracts/signatures/send',
}

const CONTRACT_SIGNATURE_USER_HISTORY: GaTenantMenuItem = {
  label: '전자서명 발송내역',
  path: '/contracts/signatures/history',
}

const CONTRACT_SIGNATURE_ADMIN_MENU: GaTenantMenuItem = {
  label: '전자서명 템플릿 관리',
  path: '/admin/contract-signatures',
}

const PDF_TEMPLATE_ADMIN_MENU: GaTenantMenuItem = {
  label: 'PDF 문서 템플릿',
  path: '/admin/pdf-templates',
}

const INSURANCE_CLAIM_USER_MENU: GaTenantMenuItem = {
  label: '보험청구',
  path: '/insurance-claim/requests',
}

const INSURANCE_CLAIM_COMPANY_ADMIN_MENU: GaTenantMenuItem = {
  label: '보험청구 설정',
  path: '/admin/claim/insurance-companies',
}

function buildGaTenantAdminMenuEntries(role: string | undefined): GaTenantDashboardMenuEntry[] {
  const entries: GaTenantDashboardMenuEntry[] = []
  const documentItems: GaTenantMenuItem[] = []

  if (canUseInsuranceClaimAdminRoutes(role)) {
    entries.push({ type: 'section', label: '보험청구 설정' })
    entries.push({
      type: 'link',
      label: INSURANCE_CLAIM_COMPANY_ADMIN_MENU.label,
      path: INSURANCE_CLAIM_COMPANY_ADMIN_MENU.path,
    })
  }

  if (canUsePdfTemplateAdminRoutes(role)) {
    documentItems.push(PDF_TEMPLATE_ADMIN_MENU)
  }
  const signatureAdmin = contractSignatureAdminMenuIfEnabled(role)
  if (signatureAdmin) {
    documentItems.push(signatureAdmin)
  }
  if (documentItems.length > 0) {
    entries.push({ type: 'section', label: '전자문서 / 서명 관리' })
    entries.push(...itemsToEntries(documentItems))
  }

  if (canUseNewsletterBoardAdminRoutes(role)) {
    const newsletterLabel =
      role === 'SUPER_ADMIN'
        ? '소식지 관리'
        : role === 'GA_ADMIN'
          ? 'GA전용 소식지 관리'
          : '소식지 관리'
    entries.push({ type: 'section', label: '공지 / 운영 관리' })
    entries.push({ type: 'link', label: newsletterLabel, path: '/admin/newsletter-boards' })
  }

  return entries
}

function buildSuperAdminMenuEntries(): GaTenantDashboardMenuEntry[] {
  const entries: GaTenantDashboardMenuEntry[] = []

  entries.push({ type: 'section', label: '사용자 / 조직 관리' })
  entries.push(
    ...itemsToEntries([
      { label: 'GA 관리', path: '/admin/ga' },
      { label: '담당자 관리', path: '/admin/delegates' },
      { label: '유저 관리', path: '/admin/users' },
    ]),
  )

  entries.push({ type: 'section', label: '결제 / 구독 관리' })
  entries.push(...itemsToEntries([{ label: '결제·구독 관리', path: '/admin/billing/manage' }]))

  entries.push({ type: 'section', label: '공지 / 운영 관리' })
  entries.push(
    ...itemsToEntries([
      { label: '공지사항 관리', path: '/admin/notices' },
      { label: '소식지 관리', path: '/admin/newsletter-boards' },
      { label: '운영 통계', path: '/admin/analytics' },
      { label: '기능 요청 관리', path: '/internal/admin/feature-requests' },
    ]),
  )

  const documentItems: GaTenantMenuItem[] = [PDF_TEMPLATE_ADMIN_MENU]
  const signatureAdmin = contractSignatureAdminMenuIfEnabled('SUPER_ADMIN')
  if (signatureAdmin) {
    documentItems.push(signatureAdmin)
  }
  entries.push({ type: 'section', label: '전자문서 / 서명 관리' })
  entries.push(...itemsToEntries(documentItems))

  entries.push({ type: 'section', label: '보험사 / 시스템 설정' })
  entries.push(
    ...itemsToEntries([
      { label: INSURANCE_CLAIM_COMPANY_ADMIN_MENU.label, path: INSURANCE_CLAIM_COMPANY_ADMIN_MENU.path },
      { label: '보험사 설계사이트 관리', path: '/admin/insurer-sites' },
      { label: '보험사 설계사이트 (일반·카드)', path: '/insurance/insurer-sites' },
      { label: '보안 감사 로그', path: '/admin/audit-logs' },
    ]),
  )

  return entries
}

function contractSignatureAdminMenuIfEnabled(role: string | undefined): GaTenantMenuItem | null {
  if (!canAccessContractSignatureAdminConsole(role)) {
    return null
  }
  return CONTRACT_SIGNATURE_ADMIN_MENU
}

function itemsToEntries(items: GaTenantMenuItem[]): GaTenantDashboardMenuEntry[] {
  return items.map((item) => ({ type: 'link' as const, label: item.label, path: item.path }))
}

export function buildAppMenuForSession(
  role: string | undefined,
  gaCode: string | undefined,
  gaName: string | undefined,
  options: AppMenuBuildOptions = {},
): GaTenantDashboardMenuEntry[] {
  const {
    teamMenuManageVisible = false,
    dynamicNewsletterBoards = [],
    subscriptionExpired = false,
  } = options

  const base: GaTenantDashboardMenuEntry[] = (() => {
    if (role === 'SUPER_ADMIN') {
      return buildSuperAdminMenuEntries()
    }
    if (role === 'INSURER_MANAGER') {
      return itemsToEntries(INSURER_MANAGER_MENU)
    }
    if (role === 'LOSS_ADJUSTER') {
      return itemsToEntries(LOSS_ADJUSTER_MENU)
    }
    if (role === 'GA_STAFF') {
      const adminEntries = buildGaTenantAdminMenuEntries(role)
      const operational = itemsToEntries([
        CONTRACT_SIGNATURE_USER_SEND,
        CONTRACT_SIGNATURE_USER_HISTORY,
        ...GA_STAFF_MENU,
        ...dynamicNewsletterBoards.map((board) => ({
          label: board.label,
          path: `/portal/boards/${encodeURIComponent(board.slug)}`,
        })),
      ])
      if (!adminEntries.length) {
        return operational
      }
      return [...adminEntries, { type: 'divider' }, ...operational]
    }
    if (role === 'GA_ADMIN' || role === 'USER') {
      const includeInsuranceClaimFeatures = canUseInsuranceClaimUserRoutes(role)
      const entries = buildGaTenantDashboardMenu(gaCode, gaName, {
        includeUserContractSignatures: role === 'USER',
        includeInsuranceClaimFeatures,
        dynamicNewsletterBoards,
      })
      if (role === 'GA_ADMIN') {
        entries.push(...buildGaTenantAdminMenuEntries('GA_ADMIN'))
        entries.push(
          { type: 'divider' },
          { type: 'section', label: '보안 / 감사' },
          { type: 'link', label: AUDIT_LOG_ENTRY.label, path: AUDIT_LOG_ENTRY.path },
        )
      }
      return entries
    }
    return []
  })()

  // 팀 관리 주입: `/team/files` 바로 다음 자리에 고정.
  const withTeam: GaTenantDashboardMenuEntry[] = (() => {
    if (!teamMenuManageVisible) {
      return base
    }
    const filesIdx = base.findIndex(
      (entry) => entry.type === 'link' && entry.path === '/team/files',
    )
    const teamManageEntry: GaTenantDashboardMenuEntry = {
      type: 'link',
      label: '팀 관리',
      path: '/team/manage',
    }
    if (filesIdx >= 0) {
      return [...base.slice(0, filesIdx + 1), teamManageEntry, ...base.slice(filesIdx + 1)]
    }
    return [...base, teamManageEntry]
  })()

  if (!subscriptionExpired) {
    return applyPublicAccountMenuPathRestrictions(
      withTeam,
      isPublicGeneralAccount({ gaCode, gaName }),
    )
  }
  return applyPublicAccountMenuPathRestrictions(
    filterMenuForExpired(withTeam),
    isPublicGeneralAccount({ gaCode, gaName }),
  )
}

function filterMenuForExpired(
  entries: GaTenantDashboardMenuEntry[],
): GaTenantDashboardMenuEntry[] {
  const allowed = entries.filter((entry) => {
    if (entry.type === 'divider') {
      return true
    }
    if (entry.type !== 'link') {
      /* 'section' 카테고리 헤더는 EXPIRED 유저에게는 의미가 없으므로 제거한다. */
      return false
    }
    if (entry.disabled || entry.preparing) {
      return false
    }
    return isAllowedForExpiredFrontend(entry.path)
  })
  return collapseRedundantDividers(allowed)
}

function collapseRedundantDividers(
  entries: GaTenantDashboardMenuEntry[],
): GaTenantDashboardMenuEntry[] {
  const result: GaTenantDashboardMenuEntry[] = []
  for (const entry of entries) {
    if (entry.type !== 'divider') {
      result.push(entry)
      continue
    }
    const previous = result[result.length - 1]
    if (!previous || previous.type === 'divider') {
      continue
    }
    result.push(entry)
  }
  if (result[result.length - 1]?.type === 'divider') {
    result.pop()
  }
  return result
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
  return buildGaTenantDashboardMenu(gaCode, gaName).flatMap((e) => {
    if (e.type !== 'link') {
      return []
    }
    return [{ label: e.label, path: e.disabled || e.preparing ? '#' : e.path }]
  })
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
