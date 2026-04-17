import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { getCustomerById } from '../api/customersApi'
import { listCustomerRelations, type CustomerRelationRow } from '../api/customerExtraApi'
import type { CustomerNotesBag, CustomerRecord } from '../domain/types'
import { normalizeCustomerNotesBag } from '../domain/types'
import { CUSTOMER_MEDICAL_QUESTION_HINT, CUSTOMER_MEDICAL_QUESTION_TEXT } from '../utils/customerDisplayFormat'
import { CustomerInlineNotesSection } from '../components/CustomerInlineNotesSection'
import { useGaSettings } from '../../ga-settings/useGaSettings'

function formatGender(gender: CustomerRecord['gender']): string {
  if (gender === 'male') {
    return '남'
  }
  if (gender === 'female') {
    return '여'
  }
  return '—'
}

export default function CustomerDetailPage() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()
  const isMobile = useIsMobile()
  const { gaSettings, loading: gaSettingsLoading } = useGaSettings()

  const numericCustomerId = Number(customerId)
  const validCustomerId = Number.isInteger(numericCustomerId) && numericCustomerId > 0

  const [customer, setCustomer] = useState<CustomerRecord | null>(null)
  const [linkedCustomers, setLinkedCustomers] = useState<CustomerRelationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusText, setStatusText] = useState('')

  useEffect(() => {
    if (!token?.trim() || !validCustomerId) {
      queueMicrotask(() => setLoading(false))
      return
    }
    let cancelled = false
    queueMicrotask(() => setLoading(true))
    void getCustomerById(token, numericCustomerId)
      .then((row) => {
        if (cancelled) {
          return
        }
        setCustomer(row)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }
        setCustomer(null)
        setStatusText(error instanceof Error ? error.message : '고객 상세를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [numericCustomerId, token, validCustomerId])

  useEffect(() => {
    if (!token?.trim() || !validCustomerId) {
      queueMicrotask(() => setLinkedCustomers([]))
      return
    }
    let cancelled = false
    void listCustomerRelations(token, numericCustomerId)
      .then((rows) => {
        if (!cancelled) {
          setLinkedCustomers(rows)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLinkedCustomers([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [numericCustomerId, token, validCustomerId])

  const canShowGaDataButton = !gaSettingsLoading && Boolean(gaSettings.use_ga_excel)

  const notesBag: CustomerNotesBag | null = useMemo(
    () => (customer ? normalizeCustomerNotesBag(customer.notes) : null),
    [customer],
  )

  if (!validCustomerId) {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <p className="customers-page__denied">잘못된 고객 ID입니다.</p>
        </header>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <h1>고객 상세 로딩 중</h1>
          <p>고객 정보를 불러오고 있습니다.</p>
        </header>
      </main>
    )
  }

  if (!customer) {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <h1>고객을 찾을 수 없습니다.</h1>
          {statusText ? <p>{statusText}</p> : null}
        </header>
        <FormButton htmlType="button" variant="secondary" onClick={() => navigate('/customers')}>
          고객 목록으로
        </FormButton>
      </main>
    )
  }

  return (
    <main className="page page--with-back customer-detail-page">
      <header className="page-header">
        <h1>{customer.name}</h1>
        <p>{customer.phone?.trim() || '전화번호 없음'}</p>
      </header>

      <section className="customer-detail-page__section">
        <h2 className="customer-detail-page__section-title">기본 정보</h2>
        <div className="customer-detail-page__info-grid">
          <div>성별</div>
          <div>{formatGender(customer.gender)}</div>
          <div>주민번호</div>
          <div>{customer.ssn?.trim() || '—'}</div>
          <div>주소</div>
          <div>{customer.address?.trim() || '—'}</div>
          <div>직업</div>
          <div>{customer.job?.trim() || '—'}</div>
        </div>
      </section>

      <section className="customer-detail-page__section">
        <h2 className="customer-detail-page__section-title">자동차 / 보험 정보</h2>
        <div className="customer-detail-page__info-grid">
          <div>운전여부</div>
          <div>{customer.isDriver == null ? '—' : customer.isDriver ? '운전함' : '운전 안함'}</div>
          <div>차량번호</div>
          <div>{customer.carNumber?.trim() || '—'}</div>
          <div>차종</div>
          <div>{customer.carModel?.trim() || customer.carType?.trim() || '—'}</div>
          <div>연식</div>
          <div>{customer.carYear?.trim() || '—'}</div>
          <div>만기일</div>
          <div>{customer.renewalDate?.trim() || '—'}</div>
        </div>
      </section>

      <section className="customer-detail-page__section">
        <h2 className="customer-detail-page__section-title">가입 내역</h2>
        <p className="customer-detail-page__paragraph">
          {notesBag?.insuranceHistory?.trim() ? notesBag.insuranceHistory : '내용 없음'}
        </p>
      </section>

      <section className="customer-detail-page__section">
        <h2 className="customer-detail-page__section-title">건강 정보</h2>
        <p className="customer-detail-page__paragraph">{CUSTOMER_MEDICAL_QUESTION_TEXT}</p>
        <p className="customer-detail-page__paragraph customer-detail-page__paragraph--sub">
          {CUSTOMER_MEDICAL_QUESTION_HINT}
        </p>
        <p className="customer-detail-page__paragraph">{customer.medical?.trim() || '내용 없음'}</p>
      </section>

      <section className="customer-detail-page__section linked-customers">
        <h2 className="customer-detail-page__section-title">연계 고객</h2>
        {linkedCustomers.length === 0 ? (
          <p className="customer-detail-page__paragraph">연계 고객이 없습니다.</p>
        ) : (
          <ul className="customer-detail-page__linked-list">
            {linkedCustomers.map((row) => (
              <li key={row.relatedCustomerId}>
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  className="customer-detail-page__linked-item"
                  onClick={() => navigate(`/customer/${row.relatedCustomerId}`)}
                >
                  {row.relatedName?.trim() || `고객 #${row.relatedCustomerId}`}
                </FormButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="customer-detail-page__section">
        <CustomerInlineNotesSection
          customer={customer}
          token={token}
          showFileShortcut={false}
          onStatusMessage={setStatusText}
          onPersisted={(id, newMemo) => {
            if (id !== customer.id) {
              return
            }
            setCustomer((previous) => (previous ? { ...previous, notes: newMemo } : previous))
          }}
        />
      </section>

      <section className="customer-detail-page__section">
        <div
          className={`customer-actions${isMobile ? ' customer-actions--mobile' : ' customer-actions--pc'}`}
        >
          <FormButton htmlType="button" variant="action" onClick={() => navigate(`/customer/${customer.id}/files`)}>
            고객 파일
          </FormButton>
          <FormButton htmlType="button" variant="action" onClick={() => navigate(`/customer/${customer.id}/consults`)}>
            상담 내역
          </FormButton>
          <FormButton htmlType="button" variant="action" onClick={() => navigate(`/customer/${customer.id}/auto`)}>
            자동차 신청서
          </FormButton>
          {canShowGaDataButton ? (
            <FormButton htmlType="button" variant="action" onClick={() => navigate(`/customer/${customer.id}/ga`)}>
              GA 데이터 보기
            </FormButton>
          ) : null}
        </div>
      </section>
    </main>
  )
}
