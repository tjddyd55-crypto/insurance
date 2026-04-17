import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { getCustomerById, type UpdateCustomerBody } from '../api/customersApi'
import { CustomerInlineNotesSection } from '../components/CustomerInlineNotesSection'
import type { CustomerNotesBag, CustomerRecord } from '../domain/types'

export default function CustomerMemosPage() {
  const { customerId: customerIdParam } = useParams()
  const customerId = Number(customerIdParam)
  const { token } = useAuth()
  const [customer, setCustomer] = useState<CustomerRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusText, setStatusText] = useState('')

  const loadCustomer = useCallback(async () => {
    if (!token?.trim() || !customerId || customerId < 1) {
      setCustomer(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const row = await getCustomerById(token, customerId)
      setCustomer(row)
      setStatusText('')
    } catch (error) {
      setCustomer(null)
      setStatusText(error instanceof Error ? error.message : '고객 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [customerId, token])

  useEffect(() => {
    void loadCustomer()
  }, [loadCustomer])

  if (!customerId || customerId < 1) {
    return (
      <section className="customer-workspace-home">
        <h3 className="customer-workspace-home__title">고객 메모</h3>
        <p className="customer-workspace-home__desc">고객을 먼저 선택해 주세요.</p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="customer-workspace-home">
        <h3 className="customer-workspace-home__title">고객 메모</h3>
        <p className="customer-workspace-home__desc">불러오는 중...</p>
      </section>
    )
  }

  if (!customer || !token?.trim()) {
    return (
      <section className="customer-workspace-home">
        <h3 className="customer-workspace-home__title">고객 메모</h3>
        <p className="customer-workspace-home__desc">{statusText || '고객 정보를 불러오지 못했습니다.'}</p>
        <FormButton htmlType="button" variant="action" className="filter-button" onClick={() => void loadCustomer()}>
          다시 시도
        </FormButton>
      </section>
    )
  }

  return (
    <section className="customer-workspace-home">
      <h3 className="customer-workspace-home__title">고객 메모</h3>
      <p className="customer-workspace-home__desc">
        고객 #{customer.id} · {customer.name}
      </p>
      <CustomerInlineNotesSection
        key={customer.id}
        customer={customer}
        token={token}
        showFileShortcut={false}
        onPersisted={(customerIdFromNotes: number, newMemo: CustomerNotesBag) => {
          setCustomer((prev) => {
            if (!prev || prev.id !== customerIdFromNotes) {
              return prev
            }
            const nextNotes = newMemo as unknown as UpdateCustomerBody['notes']
            return { ...prev, notes: nextNotes }
          })
        }}
        onStatusMessage={setStatusText}
      />
      {statusText ? <p className="customer-workspace-home__selected">{statusText}</p> : null}
    </section>
  )
}
