import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import {
  createCustomerConsultation,
  createCustomerRelation,
  listCustomerConsultations,
  listCustomerRelations,
  type CustomerConsultationRow,
  type CustomerRelationRow,
} from '../api/customerExtraApi'
import { localYmd, parseConsultationStoredBody } from '../utils/consultationBodyFormat'

export default function CustomerConsultationsPage() {
  const { id: idParam } = useParams()
  const navigate = useNavigate()
  const customerId = Number(idParam)
  const { token } = useAuth()
  const [rows, setRows] = useState<CustomerConsultationRow[]>([])
  const [relRows, setRelRows] = useState<CustomerRelationRow[]>([])
  const [body, setBody] = useState('')
  const [consultDate, setConsultDate] = useState(() => localYmd())
  const [relatedId, setRelatedId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const validId = Number.isInteger(customerId) && customerId > 0

  const loadAll = useCallback(async () => {
    if (!token?.trim() || !validId) {
      return
    }
    setError('')
    setNotFound(false)
    try {
      const [c, r] = await Promise.all([
        listCustomerConsultations(token, customerId, { limit: 100 }),
        listCustomerRelations(token, customerId),
      ])
      setRows(c)
      setRelRows(r)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true)
        setRows([])
        setRelRows([])
        return
      }
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.')
    }
  }, [token, customerId, validId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const onSubmitConsultation = async (e: FormEvent) => {
    e.preventDefault()
    if (!token?.trim() || !validId) {
      return
    }
    const t = body.trim()
    if (!t) {
      setError('상담 내용을 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createCustomerConsultation(token, customerId, t)
      setBody('')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onAddRelation = async (e: FormEvent) => {
    e.preventDefault()
    if (!token?.trim() || !validId) {
      return
    }
    const n = Number(relatedId)
    if (!Number.isInteger(n) || n < 1) {
      setError('연결할 고객 번호를 숫자로 입력해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createCustomerRelation(token, customerId, n)
      setRelatedId('')
      window.alert('고객을 연결했습니다.')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : '연결에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (!validId) {
    return (
      <div className="page-shell" style={{ padding: '1rem' }}>
        <p>잘못된 고객 ID입니다.</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="page-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
        <h1 style={{ marginTop: 12 }}>고객을 찾을 수 없음</h1>
        <p style={{ color: 'var(--text-secondary)' }}>삭제되었거나 접근할 수 없는 고객입니다.</p>
        <button
          type="button"
          style={{ marginTop: 12, padding: '0.5rem 1rem' }}
          onClick={() => navigate('/customers')}
        >
          고객 목록으로
        </button>
      </div>
    )
  }

  return (
    <div className="page-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ marginTop: 12 }}>고객 상담 · 연결</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>고객 #{customerId}</p>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        보험 메모·인수 용도 메모는 기존 고객 상세의 <code>notes</code> JSON 필드를 그대로 쓰는 것을 권장합니다. 여기서는
        일정·통화 등 <strong>상담 이력</strong>과 다른 고객과의 <strong>연결</strong>만 다룹니다.
      </p>
      {error ? (
        <p style={{ color: 'var(--danger)' }} role="alert">
          {error}
        </p>
      ) : null}

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: '1.05rem' }}>상담 기록</h2>
        <form onSubmit={onSubmitConsultation} style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>
            상담 일자{' '}
            <input type="date" value={consultDate} onChange={(ev) => setConsultDate(ev.target.value)} />
          </label>
          <textarea
            value={body}
            onChange={(ev) => setBody(ev.target.value)}
            rows={4}
            style={{ width: '100%', padding: 8 }}
            placeholder="상담 내용"
            maxLength={19500}
          />
          <button type="submit" disabled={busy} style={{ marginTop: 8 }}>
            {busy ? '저장 중…' : '상담 추가'}
          </button>
        </form>
        {rows.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>등록된 상담이 없습니다.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {rows.map((r) => {
              const { dateLabel, text } = parseConsultationStoredBody(r.body, r.createdAt)
              return (
                <li
                  key={r.id}
                  style={{
                    borderBottom: '1px solid var(--border-default)',
                    padding: '12px 0',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{dateLabel}</div>
                  <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{text || '—'}</div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: '1.05rem' }}>연결된 고객</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          동일 GA·내 명의의 다른 고객 ID를 연결하면 양방향으로 조회됩니다.
        </p>
        <form onSubmit={onAddRelation} style={{ marginBottom: 16 }}>
          <label>
            연결할 고객 ID
            <input
              type="number"
              min={1}
              value={relatedId}
              onChange={(ev) => setRelatedId(ev.target.value)}
              style={{ display: 'block', width: 200, marginTop: 4, padding: 8 }}
            />
          </label>
          <button type="submit" disabled={busy} style={{ display: 'block', marginTop: 8 }}>
            {busy ? '처리 중…' : '연결 추가'}
          </button>
        </form>
        {relRows.length === 0 ? (
          <p style={{ color: '#666' }}>연결된 고객이 없습니다.</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {relRows.map((r) => (
              <li key={`${r.relatedCustomerId}-${r.createdAt}`} style={{ marginBottom: 8 }}>
                <strong>#{r.relatedCustomerId}</strong> {r.relatedName}
                <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: '0.9rem' }}>
                  {r.relatedPhone}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
