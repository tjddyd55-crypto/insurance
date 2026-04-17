import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../../../components/feedback'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { fetchGaCustomerExcelCapability, type GaCustomerExcelCapability } from '../api/gaCustomerExcelApi'
import { getCustomerById } from '../api/customersApi'
import { ApplicationFormPage } from '../../application/pages/ApplicationFormPage'
import { isGaCarInsuranceHubEnabled } from '../../dashboard/gaTenantMenu'
import { useIsMobile } from '../../../hooks/useIsMobile'
import CustomersPage from './CustomersPage'

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

function rightTitle(pathname: string): string {
  if (pathname.includes('/files')) {
    return '고객 파일 작업'
  }
  if (pathname.includes('/consultations')) {
    return '고객 상담 작업'
  }
  if (pathname.includes('/ga-excel')) {
    return 'GA 고객 데이터'
  }
  if (pathname.includes('/memos')) {
    return '고객 메모'
  }
  return '작업 영역'
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
    navigate(buildCustomerWorkspaceHref(path, searchParams))
  }

  const safeTab = currentPathTab ?? 'files'

  useEffect(() => {
    if (isMobile || queryCustomerId == null || selectedCustomerId == null) {
      return
    }
    if (queryCustomerId === selectedCustomerId) {
      return
    }
    navigate(buildCustomerWorkspaceHref(`/customers/${queryCustomerId}/${safeTab}`, searchParams), {
      replace: true,
    })
  }, [isMobile, navigate, queryCustomerId, safeTab, searchParams, selectedCustomerId])

  const activeTab: 'files' | 'consultations' | 'auto' | 'ga-excel' | 'memos' | null = rightPanelCarForm
    ? 'auto'
    : currentPathTab

  return (
    <div className="customer-workspace-layout">
      <aside className="customer-workspace-layout__left" aria-label="고객 작업공간">
        <CustomersPage />
      </aside>

      {!isMobile ? (
        <section className="customer-workspace-layout__right" aria-label="고객 연동 작업영역">
          <header className="customer-workspace-layout__right-header">
            <div>
              <h2 className="customer-workspace-layout__title">
                {rightPanelCarForm ? '자동차 신청서' : rightTitle(location.pathname)}
              </h2>
              <p className="customer-workspace-layout__subtitle">
                선택 고객:{' '}
                {selectedCustomerId
                  ? selectedCustomerLabel || `고객 #${selectedCustomerId}`
                  : '미선택'}
              </p>
            </div>
            <div className="customer-workspace-layout__actions">
              <FormButton
                htmlType="button"
                variant="action"
                className={`filter-button${activeTab === 'files' ? ' filter-button--workspace-active' : ''}`}
                disabled={!selectedCustomerId}
                onClick={() => {
                  if (!selectedCustomerId) {
                    return
                  }
                  setRightPanelCarForm(false)
                  moveTo(`/customers/${selectedCustomerId}/files`)
                }}
              >
                고객 파일
              </FormButton>
              <FormButton
                htmlType="button"
                variant="action"
                className={`filter-button${activeTab === 'consultations' ? ' filter-button--workspace-active' : ''}`}
                disabled={!selectedCustomerId}
                onClick={() => {
                  if (!selectedCustomerId) {
                    return
                  }
                  setRightPanelCarForm(false)
                  moveTo(`/customers/${selectedCustomerId}/consultations`)
                }}
              >
                상담 이력
              </FormButton>
              {showCarInsuranceInWorkspace ? (
                <FormButton
                  htmlType="button"
                  variant="action"
                  className={`filter-button${rightPanelCarForm ? ' filter-button--workspace-active' : ''}`}
                  disabled={!selectedCustomerId}
                  onClick={() => {
                    if (!selectedCustomerId) {
                      return
                    }
                    setRightPanelCarForm(true)
                  }}
                >
                  자동차 신청서
                </FormButton>
              ) : null}
              {showGaExcelEntry ? (
                <FormButton
                  htmlType="button"
                  variant="action"
                  className={`filter-button${activeTab === 'ga-excel' ? ' filter-button--workspace-active' : ''}`}
                  disabled={!selectedCustomerId || !excelCap?.showDesignerUi}
                  title={
                    excelCap?.showDesignerUi
                      ? undefined
                      : excelCap?.message || '고객 엑셀 기능을 사용할 수 없습니다.'
                  }
                  onClick={() => {
                    if (!selectedCustomerId || !excelCap?.showDesignerUi) {
                      return
                    }
                    setRightPanelCarForm(false)
                    moveTo(`/customers/${selectedCustomerId}/ga-excel`)
                  }}
                >
                  GA 고객 데이터 보기
                </FormButton>
              ) : null}
              <FormButton
                htmlType="button"
                variant="action"
                className={`filter-button${activeTab === 'memos' ? ' filter-button--workspace-active' : ''}`}
                disabled={!selectedCustomerId}
                onClick={() => {
                  if (!selectedCustomerId) {
                    return
                  }
                  setRightPanelCarForm(false)
                  moveTo(`/customers/${selectedCustomerId}/memos`)
                }}
              >
                메모 보기
              </FormButton>
            </div>
          </header>

          <div className="customer-workspace-layout__right-body">
            {rightPanelCarForm && selectedCustomerId ? (
              <div
                className="customer-workspace-layout__embedded-car"
                role="region"
                aria-label="자동차 신청서 작성"
              >
                <div className="customer-workspace-layout__embedded-car-body">
                  <ApplicationFormPage />
                </div>
              </div>
            ) : selectedCustomerId ? (
              <Outlet context={{ selectedCustomerId }} />
            ) : (
              <EmptyState message="고객을 선택해 주세요." />
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
