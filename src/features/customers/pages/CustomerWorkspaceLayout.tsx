import { useMemo } from 'react'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import CustomersPage from './CustomersPage'

function parseSelectedCustomerId(raw: string | null): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
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
  return '작업 영역'
}

export default function CustomerWorkspaceLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const selectedCustomerId = useMemo(
    () => parseSelectedCustomerId(searchParams.get('customerId')),
    [searchParams],
  )

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
              선택 고객: {selectedCustomerId ? `#${selectedCustomerId}` : '미선택'}
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
          </div>
        </header>

        <div className="customer-workspace-layout__right-body">
          <Outlet context={{ selectedCustomerId }} />
        </div>
      </section>
    </div>
  )
}
