import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { useAuth } from '../../auth/AuthProvider'
import { fetchGaCustomerExcelCapability, type GaCustomerExcelCapability } from '../api/gaCustomerExcelApi'
import { getCustomerById } from '../api/customersApi'
import { isGaCarInsuranceHubEnabled } from '../../dashboard/gaTenantMenu'
import useIsMobile from '../../../hooks/useIsMobile'
import CustomersPageContainer from './customers/CustomersPageContainer'
import CustomerWorkspaceLayoutPC, { type CustomerWorkspaceLayoutPCProps } from './workspace/CustomerWorkspaceLayoutPC'
import CustomerWorkspaceLayoutMobile from './workspace/CustomerWorkspaceLayoutMobile'
import './workspace/CustomerWorkspaceLayoutPC.css'
import type { CustomerRecord } from '../domain/types'

function parseSelectedCustomerId(raw: string | null): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * `/customers/:id/...` 에서 id 추출. 탭 세그먼트(files 등) 유무와 무관해야
 * 청구관리 외 탭으로 이동하지 않은 상태에서도 공통 shell(앱 링크 바)이 동작한다.
 */
function parseWorkspaceCustomerIdFromPath(pathname: string): number | null {
  const m = pathname.match(/^\/customers\/(\d+)(?:\/|$)/)
  if (!m?.[1]) {
    return null
  }
  return parseSelectedCustomerId(m[1])
}

export type CustomerWorkspaceTab =
  | 'files'
  | 'consultations'
  | 'auto'
  | 'ga-excel'
  | 'memos'
  | 'claims'
  | 'personal-message'

/**
 * URL path → 현재 활성 탭 매핑.
 *
 * 규칙(routing-ssot.mdc 1):
 *   우측 패널이 "지금 어떤 메뉴를 보고 있는가" 는 오직 URL path 하나만으로 결정된다.
 *   로컬 state 나 props 로 중복 표현하지 않는다. 새로운 우측 메뉴가 추가될 때도
 *   path 규약만 추가하면 자동으로 layout·버튼 하이라이트·스크롤 복원이 일관되게 따라온다.
 */
function resolveWorkspacePathTab(pathname: string): CustomerWorkspaceTab | null {
  if (pathname.includes('/claim-requests')) {
    return 'claims'
  }
  if (pathname.includes('/consultations')) {
    return 'consultations'
  }
  if (pathname.includes('/memos')) {
    return 'memos'
  }
  if (pathname.includes('/ga-excel') || pathname.includes('/ga')) {
    return 'ga-excel'
  }
  if (pathname.includes('/auto-form')) {
    return 'auto'
  }
  if (pathname.includes('/files')) {
    return 'files'
  }
  return null
}

function buildCustomerWorkspaceHref(
  basePath: string,
  params: URLSearchParams,
  selectedCustomerId: number | null,
): string {
  const next = new URLSearchParams()
  const selectedFromQuery = parseSelectedCustomerId(params.get('customerId'))
  const selected = selectedFromQuery ?? selectedCustomerId
  if (selected != null) {
    next.set('customerId', String(selected))
  }
  const qs = next.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export default function CustomerWorkspaceLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, user } = useAuth()
  const isMobile = useIsMobile()
  const [searchParams] = useSearchParams()
  const openRelatedCustomerRef = useRef<((customerId: number, customerName?: string) => void) | null>(null)
  const currentPathTab = useMemo(
    () => resolveWorkspacePathTab(location.pathname),
    [location.pathname],
  )
  /**
   * 선택된 고객 id는 **URL path** 를 단일 진실 원천으로 삼는다.
   * `?customerId=` 쿼리는 목록(`/customers`) 같은 path가 비어있을 때의
   * 보조 정보로만 읽고, 상세 path와 어긋나도 path 값을 유지한다.
   *
   * 역사적 배경:
   *   과거에는 query → path 방향으로 `useLayoutEffect` 동기화가 있었으나,
   *   좌측 리스트가 이미 path 자체를 `replace` 하는 현재 코드와 결합되면
   *   "선택 즉시 이전 path 로 되돌리는" 역방향 덮어쓰기가 일어났다(회귀).
   *   쿼리는 보조 정보로만 두고 동기화 effect 를 제거하는 것으로 해결.
   */
  const selectedCustomerId = useMemo(() => {
    const fromPath = parseWorkspaceCustomerIdFromPath(location.pathname)
    if (fromPath != null) {
      return fromPath
    }
    return parseSelectedCustomerId(searchParams.get('customerId'))
  }, [location.pathname, searchParams])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null)
  const [excelCap, setExcelCap] = useState<GaCustomerExcelCapability | null>(null)
  const selectedCustomerLabel = useMemo(() => {
    if (selectedCustomer?.name?.trim()) {
      return selectedCustomer.name.trim()
    }
    if (selectedCustomerId) {
      return `고객 #${selectedCustomerId}`
    }
    return ''
  }, [selectedCustomer, selectedCustomerId])

  useEffect(() => {
    if (isMobile) {
      queueMicrotask(() => setSelectedCustomer(null))
      return
    }
    if (!selectedCustomerId || !token?.trim()) {
      queueMicrotask(() => setSelectedCustomer(null))
      return
    }
    let cancelled = false
    void getCustomerById(token, selectedCustomerId)
      .then((c) => {
        if (cancelled) {
          return
        }
        setSelectedCustomer(c)
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedCustomer(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isMobile, selectedCustomerId, token])

  useEffect(() => {
    if (isMobile) {
      queueMicrotask(() => setExcelCap(null))
      return
    }
    if (!token?.trim()) {
      queueMicrotask(() => setExcelCap(null))
      return
    }
    const role = String(user?.role ?? '')
    if (role === 'SUPER_ADMIN' || role === 'INSURER_MANAGER' || role === 'LOSS_ADJUSTER') {
      queueMicrotask(() => setExcelCap(null))
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const c = await fetchGaCustomerExcelCapability(token)
        if (!cancelled) {
          setExcelCap(c)
        }
      } catch {
        if (!cancelled) {
          setExcelCap(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isMobile, token, user?.role])

  const showGaExcelEntry =
    excelCap != null &&
    (excelCap.showDesignerUi || (excelCap.featureEnabled && !excelCap.configReady && Boolean(excelCap.message)))

  const showCarInsuranceInWorkspace = isGaCarInsuranceHubEnabled(user?.gaCode, user?.gaName)

  const moveTo = (path: string) => {
    const href = buildCustomerWorkspaceHref(path, searchParams, selectedCustomerId)
    navigate(href)
  }

  /**
   * 우측 패널 활성 탭은 URL path + claimTab(query) 조합으로 파생한다.
   * claim-requests 내부에서 personal 탭을 별도 메뉴로 노출할 수 있도록 query를 해석한다.
   */
  const activeTab: CustomerWorkspaceTab | null = useMemo(() => {
    if (currentPathTab === 'claims' && searchParams.get('claimTab') === 'news-personal') {
      return 'personal-message'
    }
    return currentPathTab
  }, [currentPathTab, searchParams])

  /**
   * 우측 메뉴 핸들러는 **전부 동일한 패턴**으로 통일한다: URL 이동(navigate) 하나뿐.
   * 로컬 state 토글, 조건부 렌더, 임시 force rerender 등은 사용하지 않는다.
   * 새 우측 메뉴를 추가할 때도 이 패턴만 따르면 된다.
   */
  const handleClickFiles = () => {
    if (!selectedCustomerId) {
      return
    }
    moveTo(`/customers/${selectedCustomerId}/files`)
  }

  const handleClickConsultations = () => {
    if (!selectedCustomerId) {
      return
    }
    moveTo(`/customers/${selectedCustomerId}/consultations`)
  }

  const handleClickCarForm = () => {
    if (!selectedCustomerId) {
      return
    }
    moveTo(`/customers/${selectedCustomerId}/auto-form`)
  }

  const handleClickGaExcel = () => {
    if (!selectedCustomerId || !excelCap?.showDesignerUi) {
      return
    }
    moveTo(`/customers/${selectedCustomerId}/ga-excel`)
  }

  const handleClickMemos = () => {
    if (!selectedCustomerId) {
      return
    }
    moveTo(`/customers/${selectedCustomerId}/memos`)
  }

  const handleClickClaims = () => {
    if (!selectedCustomerId) {
      return
    }
    moveTo(`/customers/${selectedCustomerId}/claim-requests`)
  }

  const handleClickPersonalMessage = () => {
    if (!selectedCustomerId) {
      return
    }
    navigate(`/customers/${selectedCustomerId}/claim-requests?customerId=${selectedCustomerId}&claimTab=news-personal`)
  }

  const rightPanelProps: CustomerWorkspaceLayoutPCProps = {
    pathname: location.pathname,
    selectedCustomerId,
    selectedCustomerLabel,
    selectedCustomer,
    activeTab,
    showCarInsuranceInWorkspace,
    showGaExcelEntry,
    gaExcelEnabledForDesigner: Boolean(excelCap?.showDesignerUi),
    gaExcelDisabledReason: excelCap?.message || '고객 엑셀 기능을 사용할 수 없습니다.',
    onClickFiles: handleClickFiles,
    onClickConsultations: handleClickConsultations,
    onClickCarForm: handleClickCarForm,
    onClickGaExcel: handleClickGaExcel,
    onClickMemos: handleClickMemos,
    onClickClaims: handleClickClaims,
    onClickPersonalMessage: handleClickPersonalMessage,
    openRelatedCustomerRef,
  }

  return (
    <div className="customer-workspace-layout">
      <aside className="customer-workspace-layout__left" aria-label="고객 작업공간">
        <CustomersPageContainer openRelatedCustomerRef={openRelatedCustomerRef} />
      </aside>

      {/**
        * 우측 panel 분기는 `ResponsiveLayout` 으로 수렴 (§8-2 원칙 1).
        * 위쪽 `useEffect` 들의 `isMobile` 가드는 모바일에서 무의미한 PC 전용
        * 데이터 fetch 를 건너뛰기 위한 "행동 분기" 이며, 이 파일이 layout 역할
        * (Tier 1 등가) 이므로 AGENTS §8-5 Tier 1 규칙상 허용된다.
        */}
      <ResponsiveLayout<CustomerWorkspaceLayoutPCProps>
        PC={CustomerWorkspaceLayoutPC}
        Mobile={CustomerWorkspaceLayoutMobile}
        viewProps={rightPanelProps}
      />
    </div>
  )
}
