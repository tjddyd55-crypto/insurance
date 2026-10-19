import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import {
  consultationChannelLabel,
  consultationLeadStatusLabel,
  fetchAdvisorConsultationLead,
  fetchAdvisorConsultationLeads,
  patchAdvisorConsultationLead,
  type AdvisorConsultationLead,
  type AdvisorConsultationLeadStatus,
} from '../api/advisorConsultationLeadsApi'
import { formatKrPhoneNumberForDisplay } from '../utils/formatKrPhoneNumber'
import '../consultation-leads.css'

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
}

function messagePreview(message: string, max = 48): string {
  const s = message.trim()
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

export default function ConsultationLeadsPage() {
  const { token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('lead')?.trim() ?? ''

  const [items, setItems] = useState<AdvisorConsultationLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<AdvisorConsultationLead | null>(null)
  const [patching, setPatching] = useState(false)

  const loadList = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const res = await fetchAdvisorConsultationLeads(token)
      setItems(res.items)
    } catch {
      setError('상담 신청 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (!token || !selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    void fetchAdvisorConsultationLead(token, selectedId)
      .then((res) => {
        if (!cancelled) setDetail(res.item)
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [token, selectedId])

  const selectLead = (id: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('lead', id)
    setSearchParams(next, { replace: false })
  }

  const updateStatus = async (status: AdvisorConsultationLeadStatus) => {
    if (!token || !detail || patching) return
    setPatching(true)
    try {
      const res = await patchAdvisorConsultationLead(token, detail.id, { status })
      setDetail(res.item)
      setItems((prev) => prev.map((row) => (row.id === res.item.id ? res.item : row)))
    } catch {
      setError('상태 변경에 실패했습니다.')
    } finally {
      setPatching(false)
    }
  }

  const phoneDisplay = useMemo(
    () => formatKrPhoneNumberForDisplay(detail?.phoneDisplay || detail?.phoneNormalized || ''),
    [detail],
  )

  return (
    <main className="page consultation-leads-page">
      <h1>상담 신청</h1>
      <p className="consultation-leads-page__hint">모바일 명함을 통해 접수된 상담 신청만 표시됩니다.</p>
      {error ? <p className="status status--error" role="alert">{error}</p> : null}

      <div className="consultation-leads-layout">
        <section className="consultation-leads-list" aria-label="상담 신청 목록">
          {loading ? <p>불러오는 중…</p> : null}
          {!loading && items.length === 0 ? <p>접수된 상담 신청이 없습니다.</p> : null}
          <ul className="consultation-leads-list__items">
            {items.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`consultation-leads-card${row.id === selectedId ? ' consultation-leads-card--active' : ''}${row.status === 'new' ? ' consultation-leads-card--new' : ''}`}
                  onClick={() => selectLead(row.id)}
                >
                  <div className="consultation-leads-card__top">
                    <span className={`consultation-leads-card__status consultation-leads-card__status--${row.status}`}>
                      {consultationLeadStatusLabel(row.status)}
                    </span>
                    <time dateTime={row.createdAt ?? ''}>{formatDateTime(row.createdAt)}</time>
                  </div>
                  <strong>{row.visitorName}</strong>
                  <p className="consultation-leads-card__phone">
                    {formatKrPhoneNumberForDisplay(row.phoneDisplay || row.phoneNormalized)}
                  </p>
                  <p className="consultation-leads-card__message">{messagePreview(row.message)}</p>
                  <span className="consultation-leads-card__channel">{consultationChannelLabel(row.contactChannel)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="consultation-leads-detail" aria-label="상담 신청 상세">
          {!detail ? (
            <p className="consultation-leads-detail__empty">목록에서 상담 신청을 선택해 주세요.</p>
          ) : (
            <>
              <h2>{detail.visitorName}</h2>
              <dl className="consultation-leads-detail__facts">
                <div>
                  <dt>접수일시</dt>
                  <dd>{formatDateTime(detail.createdAt)}</dd>
                </div>
                <div>
                  <dt>연락처</dt>
                  <dd>
                    <a href={`tel:${detail.phoneNormalized}`}>{phoneDisplay}</a>
                  </dd>
                </div>
                <div>
                  <dt>연락 희망</dt>
                  <dd>{consultationChannelLabel(detail.contactChannel)}</dd>
                </div>
                <div>
                  <dt>문의 내용</dt>
                  <dd className="consultation-leads-detail__message">{detail.message}</dd>
                </div>
                <div>
                  <dt>개인정보 동의</dt>
                  <dd>{detail.privacyConsent ? '동의함' : '—'}</dd>
                </div>
                <div>
                  <dt>동의일시</dt>
                  <dd>{formatDateTime(detail.privacyConsentAt)}</dd>
                </div>
                <div>
                  <dt>약관 버전</dt>
                  <dd>{detail.privacyPolicyVersion || '—'}</dd>
                </div>
                <div>
                  <dt>상태</dt>
                  <dd>{consultationLeadStatusLabel(detail.status)}</dd>
                </div>
              </dl>
              <div className="consultation-leads-detail__actions">
                <a className="pap-btn pap-btn--primary" href={`tel:${detail.phoneNormalized}`}>전화하기</a>
                <a className="pap-btn pap-btn--secondary" href={`sms:${detail.phoneNormalized}`}>문자하기</a>
                <button
                  type="button"
                  className="pap-btn pap-btn--secondary"
                  disabled={patching || detail.status !== 'new'}
                  onClick={() => void updateStatus('checked')}
                >
                  확인
                </button>
                <button
                  type="button"
                  className="pap-btn pap-btn--secondary"
                  disabled={patching || detail.status === 'completed'}
                  onClick={() => void updateStatus('completed')}
                >
                  완료
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
