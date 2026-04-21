import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { devWorkspaceLog } from '../../../dev/devWorkspaceLog'
import { fetchGaCustomerExcelCapability, type GaCustomerExcelCapability } from '../api/gaCustomerExcelApi'
import { getCustomerById } from '../api/customersApi'
import { isGaCarInsuranceHubEnabled } from '../../dashboard/gaTenantMenu'
import useIsMobile from '../../../hooks/useIsMobile'
import CustomersPageContainer from './customers/CustomersPageContainer'
import CustomerWorkspaceLayoutPC from './workspace/CustomerWorkspaceLayoutPC'
import CustomerWorkspaceLayoutMobile from './workspace/CustomerWorkspaceLayoutMobile'

function parseSelectedCustomerId(raw: string | null): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Path-based customer (files/consultations/ga-excel) wins over ?customerId= so list expand does not override the workspace header. */
function parseWorkspaceCustomerIdFromPath(pathname: string): number | null {
  const tab = resolveWorkspacePathTab(pathname)
  if (!tab) {
    return null
  }
  const m = pathname.match(/^\/customers\/(\d+)(?:\/|$)/)
  if (!m?.[1]) {
    return null
  }
  return parseSelectedCustomerId(m[1])
}

function resolveWorkspacePathTab(pathname: string): 'files' | 'consultations' | 'ga-excel' | 'memos' | null {
  if (pathname.includes('/consultations')) {
    return 'consultations'
  }
  if (pathname.includes('/memos')) {
    return 'memos'
  }
  if (pathname.includes('/ga-excel') || pathname.includes('/ga')) {
    return 'ga-excel'
  }
  if (pathname.includes('/files')) {
    return 'files'
  }
  return null
}

function buildCustomerWorkspaceHref(basePath: string, params: URLSearchParams): string {
  const next = new URLSearchParams()
  const selected = params.get('customerId')
  if (selected) {
    next.set('customerId', selected)
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
  const currentPathTab = useMemo(
    () => resolveWorkspacePathTab(location.pathname),
    [location.pathname],
  )
  const queryCustomerId = useMemo(
    () => parseSelectedCustomerId(searchParams.get('customerId')),
    [searchParams],
  )
  const selectedCustomerId = useMemo(() => {
    const fromPath = parseWorkspaceCustomerIdFromPath(location.pathname)
    if (fromPath != null) {
      return fromPath
    }
    return parseSelectedCustomerId(searchParams.get('customerId'))
  }, [location.pathname, searchParams])
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState('')
  const [excelCap, setExcelCap] = useState<GaCustomerExcelCapability | null>(null)
  /** 우측 패널에서만 자동차 신청서 작성(전역 라우트 이동 없음) */
  const [rightPanelCarForm, setRightPanelCarForm] = useState(false)

  useEffect(() => {
    if (isMobile) {
      queueMicrotask(() => setSelectedCustomerLabel(''))
      return
    }
    if (!selectedCustomerId || !token?.trim()) {
      queueMicrotask(() => setSelectedCustomerLabel(''))
      return
    }
    let cancelled = false
    void getCustomerById(token, selectedCustomerId)
      .then((c) => {
        if (cancelled) {
          return
        }
        const name = c?.name?.trim()
        setSelectedCustomerLabel(name || `고객 #${selectedCustomerId}`)
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedCustomerLabel(`고객 #${selectedCustomerId}`)
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
    const href = buildCustomerWorkspaceHref(path, searchParams)
    devWorkspaceLog('navigate', { from: location.pathname, to: href })
    navigate(href)
  }

  const safeTab = currentPathTab ?? 'files'

  // 좌측 리스트가 쿼리만 먼저 바꾸고 path가 뒤따라오는 순간,
  // 자식(Files/Consultations/Memos/GA)이 useParams로 path를 읽기 때문에
  // 이전 고객 화면이 한 프레임 보이는 "한 박자 지연"이 발생한다.
  // useLayoutEffect로 paint 이전에 path를 맞춰 중간 상태를 사용자에게 노출하지 않는다.
  useLayoutEffect(() => {
    if (isMobile || queryCustomerId == null || selectedCustomerId == null) {
      return
    }
    if (queryCustomerId === selectedCustomerId) {
      return
    }
    const href = buildCustomerWorkspaceHref(`/customers/${queryCustomerId}/${safeTab}`, searchParams)
    devWorkspaceLog('sync-query-to-path', {
      from: location.pathname,
      to: href,
      queryCustomerId,
      selectedCustomerId,
    })
    navigate(href, {
      replace: true,
    })
  }, [isMobile, location.pathname, navigate, queryCustomerId, safeTab, searchParams, selectedCustomerId])

  const renderSignatureRef = useRef<string>('')
  const renderSignature = `${location.pathname}|q=${queryCustomerId ?? 'null'}|s=${selectedCustomerId ?? 'null'}|tab=${currentPathTab ?? 'null'}|carForm=${rightPanelCarForm}`

  useEffect(() => {
    if (renderSignatureRef.current === renderSignature) {
      return
    }
    renderSignatureRef.current = renderSignature
    devWorkspaceLog('render', {
      pathname: location.pathname,
      search: location.search,
      queryCustomerId,
      selectedCustomerId,
      currentPathTab,
      rightPanelCarForm,
    })
  }, [
    renderSignature,
    location.pathname,
    location.search,
    queryCustomerId,
    selectedCustomerId,
    currentPathTab,
    rightPanelCarForm,
  ])

  const activeTab: 'files' | 'consultations' | 'auto' | 'ga-excel' | 'memos' | null = rightPanelCarForm
    ? 'auto'
    : currentPathTab

  const handleClickFiles = () => {
    devWorkspaceLog('click:files', { selectedCustomerId })
    if (!selectedCustomerId) {
      return
    }
    setRightPanelCarForm(false)
    moveTo(`/customers/${selectedCustomerId}/files`)
  }

  const handleClickConsultations = () => {
    devWorkspaceLog('click:consultations', { selectedCustomerId })
    if (!selectedCustomerId) {
      return
    }
    setRightPanelCarForm(false)
    moveTo(`/customers/${selectedCustomerId}/consultations`)
  }

  const handleClickCarForm = () => {
    devWorkspaceLog('click:car-form', { selectedCustomerId })
    if (!selectedCustomerId) {
      return
    }
    setRightPanelCarForm(true)
  }

  const handleClickGaExcel = () => {
    devWorkspaceLog('click:ga-excel', {
      selectedCustomerId,
      showDesignerUi: excelCap?.showDesignerUi ?? null,
    })
    if (!selectedCustomerId || !excelCap?.showDesignerUi) {
      return
    }
    setRightPanelCarForm(false)
    moveTo(`/customers/${selectedCustomerId}/ga-excel`)
  }

  const handleClickMemos = () => {
    devWorkspaceLog('click:memos', { selectedCustomerId })
    if (!selectedCustomerId) {
      return
    }
    setRightPanelCarForm(false)
    moveTo(`/customers/${selectedCustomerId}/memos`)
  }

  return (
    <div className="customer-workspace-layout">
      <aside className="customer-workspace-layout__left" aria-label="고객 작업공간">
        <CustomersPageContainer />
      </aside>

      {!isMobile ? (
        <CustomerWorkspaceLayoutPC
          pathname={location.pathname}
          selectedCustomerId={selectedCustomerId}
          selectedCustomerLabel={selectedCustomerLabel}
          rightPanelCarForm={rightPanelCarForm}
          activeTab={activeTab}
          showCarInsuranceInWorkspace={showCarInsuranceInWorkspace}
          showGaExcelEntry={showGaExcelEntry}
          gaExcelEnabledForDesigner={Boolean(excelCap?.showDesignerUi)}
          gaExcelDisabledReason={excelCap?.message || '고객 엑셀 기능을 사용할 수 없습니다.'}
          onClickFiles={handleClickFiles}
          onClickConsultations={handleClickConsultations}
          onClickCarForm={handleClickCarForm}
          onClickGaExcel={handleClickGaExcel}
          onClickMemos={handleClickMemos}
        />
      ) : (
        <CustomerWorkspaceLayoutMobile />
      )}
    </div>
  )
}
