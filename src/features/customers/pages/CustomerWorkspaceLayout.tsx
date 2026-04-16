import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { fetchGaCustomerExcelCapability, type GaCustomerExcelCapability } from '../api/gaCustomerExcelApi'
import { getCustomerById } from '../api/customersApi'
import CustomersPage from './CustomersPage'

function parseSelectedCustomerId(raw: string | null): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Path-based customer (files/consultations/ga-excel) wins over ?customerId= so list expand does not override the workspace header. */
function parseWorkspaceCustomerIdFromPath(pathname: string): number | null {
  const m = pathname.match(/^\/customers\/(\d+)\/(?:files|consultations|ga-excel)(?:\/|$)/)
  if (!m?.[1]) {
    return null
  }
  return parseSelectedCustomerId(m[1])
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
  return '작업 영역'
}

export default function CustomerWorkspaceLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, user } = useAuth()
  const [searchParams] = useSearchParams()
  const selectedCustomerId = useMemo(() => {
    const fromPath = parseWorkspaceCustomerIdFromPath(location.pathname)
    if (fromPath != null) {
      return fromPath
    }
    return parseSelectedCustomerId(searchParams.get('customerId'))
  }, [location.pathname, searchParams])
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState('')
  const [excelCap, setExcelCap] = useState<GaCustomerExcelCapability | null>(null)

  useEffect(() => {
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
  }, [selectedCustomerId, token])

  useEffect(() => {
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
  }, [token, user?.role])

  const showGaExcelEntry =
    excelCap != null &&
    (excelCap.showDesignerUi || (excelCap.featureEnabled && !excelCap.configReady && Boolean(excelCap.message)))

  const moveTo = (path: string) => {
    navigate(buildCustomerWorkspaceHref(path, searchParams))
  }

  return (
    <div className="customer-workspace-layout">
      <aside className="customer-workspace-layout__left" aria-label="고객 작업공간">
        <CustomersPage />
      </aside>

      <section className="customer-workspace-layout__right" aria-label="고객 연동 작업영역">
        <header className="customer-workspace-layout__right-header">
          <div>
            <h2 className="customer-workspace-layout__title">{rightTitle(location.pathname)}</h2>
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
              className="filter-button"
              disabled={!selectedCustomerId}
              onClick={() => {
                if (!selectedCustomerId) {
                  return
                }
                moveTo(`/customers/${selectedCustomerId}/files`)
              }}
            >
              고객 파일
            </FormButton>
            <FormButton
              htmlType="button"
              variant="action"
              className="filter-button"
              disabled={!selectedCustomerId}
              onClick={() => {
                if (!selectedCustomerId) {
                  return
                }
                moveTo(`/customers/${selectedCustomerId}/consultations`)
              }}
            >
              상담 이력
            </FormButton>
            <FormButton
              htmlType="button"
              variant="action"
              className="filter-button"
              disabled={!selectedCustomerId}
              onClick={() => {
                if (!selectedCustomerId) {
                  return
                }
                navigate(`/app/auto-insurance?customerId=${selectedCustomerId}`)
              }}
            >
              자동차 신청서
            </FormButton>
            {showGaExcelEntry ? (
              <FormButton
                htmlType="button"
                variant="action"
                className="filter-button"
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
                  moveTo(`/customers/${selectedCustomerId}/ga-excel`)
                }}
              >
                GA 고객 데이터 보기
              </FormButton>
            ) : null}
          </div>
        </header>

        <div className="customer-workspace-layout__right-body">
          <Outlet context={{ selectedCustomerId }} />
        </div>
      </section>
    </div>
  )
}
