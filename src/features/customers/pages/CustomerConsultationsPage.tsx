import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EmptyState, StatusMessage } from '../../../components/feedback'
import { useConfirmDialog } from '../../../components/dialog'
import { FormButton, FormInput, FormTextarea } from '../../../components/form'
import useIsMobile from '../../../hooks/useIsMobile'
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import {
  createCustomerConsultation,
  deleteCustomerConsultation,
  listCustomerConsultations,
  type CustomerConsultationRow,
} from '../api/customerExtraApi'
import { localYmd, parseConsultationStoredBody } from '../utils/consultationBodyFormat'

export default function CustomerConsultationsPage() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const resolvedCustomerId = Number(customerId)
  const { token } = useAuth()
  const isMobile = useIsMobile()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [rows, setRows] = useState<CustomerConsultationRow[]>([])
  const [body, setBody] = useState('')
  const [consultDate, setConsultDate] = useState(() => localYmd())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const validId = Number.isInteger(resolvedCustomerId) && resolvedCustomerId > 0

  useEffect(() => {
    if (!token?.trim() || !validId) {
      return
    }
    setRows([])
  }, [resolvedCustomerId, token, validId])

  const loadAll = useCallback(async () => {
    if (!token?.trim() || !validId) {
      return
    }
    setError('')
    setNotFound(false)
    try {
      const c = await listCustomerConsultations(token, resolvedCustomerId, { limit: 100 })
      setRows(c)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true)
        setRows([])
        return
      }
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.')
    }
  }, [resolvedCustomerId, token, validId])

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
      await createCustomerConsultation(token, resolvedCustomerId, t, { consultationDate: consultDate })
      setBody('')
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const onDeleteConsultation = async (consultId: number) => {
    if (!token?.trim() || !validId) {
      return
    }
    const confirmed = await confirm({
      title: '상담 삭제',
      message: '정말 삭제하시겠습니까?',
      confirmLabel: '삭제',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await deleteCustomerConsultation(token, resolvedCustomerId, consultId)
      setRows((prev) => prev.filter((item) => item.id !== consultId))
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (!validId) {
    return (
      <div className="content-wrapper page-shell">
        <p>잘못된 고객 ID입니다.</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="content-wrapper page-shell">
        <h1 style={{ marginTop: 12 }}>고객을 찾을 수 없음</h1>
        <p style={{ color: 'var(--text-secondary)' }}>삭제되었거나 접근할 수 없는 고객입니다.</p>
        <FormButton htmlType="button" variant="action" style={{ marginTop: 12 }} onClick={() => navigate('/customers')}>
          고객 목록으로
        </FormButton>
      </div>
    )
  }

  return (
    <div className="content-wrapper page-shell">
      <StatusMessage message={error} tone="error" className="!mt-0" />

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: '1.05rem' }}>상담 기록</h2>
        <form onSubmit={onSubmitConsultation} style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>
            상담 일자{' '}
            <FormInput type="date" value={consultDate} onChange={(ev) => setConsultDate(ev.target.value)} />
          </label>
          <FormTextarea
            value={body}
            onChange={(ev) => setBody(ev.target.value)}
            rows={4}
            style={{ width: '100%', padding: 8 }}
            placeholder="상담 내용"
            maxLength={19500}
          />
          <FormButton htmlType="submit" variant="action" disabled={busy} style={{ marginTop: 8 }}>
            {busy ? '저장 중…' : '상담 추가'}
          </FormButton>
        </form>
        {rows.length === 0 ? (
          <EmptyState message="등록된 상담이 없습니다." className="!my-0 !text-left" />
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
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{dateLabel}</div>
                    {!isMobile ? (
                      <FormButton
                        htmlType="button"
                        variant="action"
                        className="filter-button"
                        disabled={busy}
                        onClick={() => void onDeleteConsultation(r.id)}
                      >
                        삭제
                      </FormButton>
                    ) : null}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{text || '—'}</div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {confirmDialog}
    </div>
  )
}
