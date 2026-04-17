import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import Modal from '../../../components/ui/Modal'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { useAuth } from '../../auth/AuthProvider'
import { listCustomers } from '../api/customersApi'
import type { CustomerRecord } from '../domain/types'
import StorageWorkspace from '../../storage/components/StorageWorkspace'

type LocationState = { customerName?: string }

export default function CustomerFilesPage() {
  const { customerId: customerIdParam } = useParams<{ customerId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, token } = useAuth()
  const isMobile = useMediaQuery('(max-width: 768px)')

  const customerId = Number(customerIdParam)
  const validId = Number.isInteger(customerId) && customerId > 0

  const nameFromNav = (location.state as LocationState | null)?.customerName?.trim()
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (!isMobile || !token?.trim()) {
      return
    }
    void listCustomers(token)
      .then((result) => setCustomers(result.customers))
      .catch(() => setCustomers([]))
  }, [isMobile, token])

  const customerTitle = useMemo(() => {
    if (nameFromNav) {
      return nameFromNav
    }
    if (customers.length > 0) {
      const match = customers.find((customer) => customer.id === customerId)
      if (match?.name?.trim()) {
        return match.name.trim()
      }
    }
    return `고객 #${customerIdParam ?? ''}`
  }, [customerId, customerIdParam, customers, nameFromNav])

  if (user?.role !== 'USER' && user?.role !== 'GA_ADMIN') {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <p className="customers-page__denied">접근 권한 없음</p>
        </header>
      </main>
    )
  }

  if (!validId || !token?.trim()) {
    return (
      <div className="page-shell storage-customer-page">
        <p>{validId ? '로그인이 필요합니다.' : '잘못된 고객 ID입니다.'}</p>
        <Link to="/customers" className="underline text-[var(--link,#60a5fa)]">
          고객 목록으로
        </Link>
      </div>
    )
  }

  const customerHeader = (
    <div className="storage-customer-header">
      {isMobile ? (
        <>
          <FormButton htmlType="button" variant="secondary" onClick={() => setPickerOpen(true)}>
            {customerTitle} ▼
          </FormButton>
          <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} ariaLabel="고객 선택" panelClassName="storage-folder-sheet">
            <div className="storage-folder-sheet__title">고객 선택</div>
            <div className="storage-folder-sheet__list">
              {customers.map((customer) => (
                <FormButton
                  key={customer.id}
                  htmlType="button"
                  variant={customer.id === customerId ? 'primary' : 'secondary'}
                  className="storage-folder-sheet__item"
                  onClick={() => {
                    setPickerOpen(false)
                    navigate(`/customer/${customer.id}/files`, {
                      state: { customerName: customer.name },
                    })
                  }}
                >
                  {customer.name}
                </FormButton>
              ))}
            </div>
          </Modal>
        </>
      ) : (
        <h2 className="storage-customer-header__name">{customerTitle}</h2>
      )}
      <div className="storage-customer-header__tabs">
        <FormButton htmlType="button" variant="primary" onClick={() => navigate(`/customer/${customerId}/files`)}>
          고객 파일
        </FormButton>
        <FormButton htmlType="button" variant="secondary" onClick={() => navigate(`/customer/${customerId}/consults`)}>
          상담 이력
        </FormButton>
      </div>
    </div>
  )

  return (
    <StorageWorkspace
      token={token}
      customerId={customerId}
      title="고객 파일"
      subtitle="내 저장공간 UI를 동일하게 사용합니다."
      headerSlot={customerHeader}
    />
  )
}
