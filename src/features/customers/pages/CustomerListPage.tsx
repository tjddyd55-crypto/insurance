import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton, FormInput } from '../../../components/form'
import { useAuth } from '../../auth/AuthProvider'
import { listCustomers } from '../api/customersApi'
import type { CustomerRecord } from '../domain/types'
import { calculateInsuranceAgeFromRrn } from '../utils/insuranceAge'

function insuranceAgeLabel(customer: CustomerRecord): string {
  const computed = calculateInsuranceAgeFromRrn(customer.ssn ?? '')
  if (computed?.insuranceAge != null) {
    return `${computed.insuranceAge}세`
  }
  if (customer.insuranceAge != null) {
    return `${customer.insuranceAge}세`
  }
  return '—'
}

export default function CustomerListPage() {
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [statusText, setStatusText] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)

  useEffect(() => {
    if (!token?.trim() || user?.role !== 'USER') {
      queueMicrotask(() => {
        setCustomers([])
        setLoading(false)
      })
      return
    }
    let cancelled = false
    queueMicrotask(() => setLoading(true))
    void listCustomers(token)
      .then((result) => {
        if (cancelled) {
          return
        }
        setCustomers(result.customers)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }
        setStatusText(error instanceof Error ? error.message : '고객 목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, user?.role])

  const filteredCustomers = useMemo(() => {
    const keyword = searchKeyword.trim()
    return customers.filter((customer) => {
      if (favoriteOnly && !customer.isFavorite) {
        return false
      }
      if (!keyword) {
        return true
      }
      return customer.name.includes(keyword) || (customer.phone ?? '').includes(keyword)
    })
  }, [customers, favoriteOnly, searchKeyword])

  if (user?.role !== 'USER') {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <p className="customers-page__denied">접근 권한 없음</p>
        </header>
      </main>
    )
  }

  return (
    <main className="page customers-page page--with-back">
      <header className="page-header customers-page__header">
        <div className="customers-page__search-row">
          <FormInput
            className="search-input customers-page__search-input"
            type="search"
            placeholder="이름 / 전화번호 검색"
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            autoComplete="off"
            aria-label="이름 또는 전화번호 검색"
          />
          <FormButton
            htmlType="button"
            variant="action"
            className={`px-3 py-2 rounded-lg border text-sm shrink-0 transition-colors ${
              favoriteOnly
                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
            }`}
            aria-pressed={favoriteOnly}
            onClick={() => setFavoriteOnly((prev) => !prev)}
          >
            중요 고객
          </FormButton>
          <FormButton htmlType="button" variant="action" className="customers-page__filter-toggle" disabled>
            필터
          </FormButton>
        </div>
        {statusText ? <p className="customers-page__status">{statusText}</p> : null}
      </header>

      <section className="list-section" style={{ marginTop: 0 }}>
        {loading ? (
          <div className="customers-page__list-loading" role="status" aria-live="polite" aria-busy="true">
            <span className="customers-page__list-loading__text">로딩 중…</span>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <p className="empty-state">검색·필터 조건에 맞는 고객이 없습니다.</p>
        ) : (
          <ul className="record-list customer-list customers-page__customer-list">
            {filteredCustomers.map((customer) => (
              <li key={customer.id} className="record-card customer-card">
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  className="customer-list-item-nav"
                  onClick={() => navigate(`/customer/${customer.id}`)}
                >
                  <div className="customer-list-item-nav__main">
                    <div className="customer-list-item-nav__title-row">
                      <strong>{customer.name}</strong>
                      <span className="customer-list-item-nav__arrow">›</span>
                    </div>
                    <div className="customer-list-item-nav__meta">
                      {customer.phone?.trim() || '전화번호 없음'} · 보험나이 {insuranceAgeLabel(customer)}
                    </div>
                  </div>
                </FormButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
