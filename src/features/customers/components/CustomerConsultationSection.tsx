import { type CSSProperties, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import {
  createCustomerConsultation,
  deleteCustomerConsultation,
  listCustomerConsultations,
  type CustomerConsultationRow,
} from '../api/customerExtraApi'
import { localYmd, parseConsultationStoredBody } from '../utils/consultationBodyFormat'

const CONSULT_PREVIEW_LIMIT = 80
const CONTENT_MAX = 19500

type Props = {
  customerId: number
  token: string
  /** 상담 생성/삭제 후 목록 건수 등 상위 동기화 */
  onMutated?: () => void
}

export function CustomerConsultationSection({ customerId, token, onMutated }: Props) {
  const [rows, setRows] = useState<CustomerConsultationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [consultDate, setConsultDate] = useState(() => localYmd())
  const [draft, setDraft] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const latestRef = useRef<HTMLLIElement | null>(null)
  const pendingScrollRef = useRef(false)

  const fetchPage = useCallback(
    async (startOffset: number, append: boolean) => {
      if (!token?.trim()) {
        return
      }
      setLoading(true)
      setError('')
      try {
        const page = await listCustomerConsultations(token, customerId, {
          limit: CONSULT_PREVIEW_LIMIT,
          offset: startOffset,
        })
        setHasMore(page.length === CONSULT_PREVIEW_LIMIT)
        if (append) {
          setRows((prev) => [...prev, ...page])
        } else {
          setRows(page)
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          setError('')
          setHasMore(false)
          if (!append) {
            setRows([])
          }
        } else {
          setError(e instanceof Error ? e.message : '상담 목록을 불러오지 못했습니다.')
          if (!append) {
            setRows([])
          }
        }
      } finally {
        setLoading(false)
      }
    },
    [token, customerId],
  )

  useEffect(() => {
    setHasMore(false)
    void fetchPage(0, false)
  }, [customerId, fetchPage])

  useEffect(() => {
    if (!pendingScrollRef.current || rows.length === 0) {
      return
    }
    pendingScrollRef.current = false
    window.requestAnimationFrame(() => {
      latestRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [rows])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content) {
      setError('상담 내용을 입력해 주세요.')
      return
    }
    if (content.length > CONTENT_MAX) {
      setError(`내용은 ${CONTENT_MAX}자 이하로 입력해 주세요.`)
      return
    }
    if (!token?.trim()) {
      return
    }
    const dateToUse = consultDate.trim() || localYmd()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateToUse)) {
      setError('상담 일자를 다시 선택해 주세요.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createCustomerConsultation(token, customerId, content, { consultationDate: dateToUse })
      setDraft('')
      setConsultDate(localYmd())
      pendingScrollRef.current = true
      await fetchPage(0, false)
      onMutated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (row: CustomerConsultationRow) => {
    if (!token?.trim()) {
      return
    }
    setError('')
    try {
      await deleteCustomerConsultation(token, customerId, row.id)
      await fetchPage(0, false)
      onMutated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  const compactBtn: CSSProperties = {
    fontSize: '0.875rem',
    padding: '4px 10px',
    minHeight: 0,
  }

  return (
    <div className="customer-form-history customer-consultation-block" style={{ marginTop: 16 }}>
      <form onSubmit={(ev) => void onSubmit(ev)} style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>+ 상담 추가</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <input
            type="date"
            className="field__control"
            value={consultDate}
            onChange={(e) => setConsultDate(e.target.value)}
            aria-label="상담 일자"
          />
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '0.85rem' }}>
            비워 두면 오늘 날짜로 저장됩니다.
          </span>
        </div>
        <textarea
          className="field__control"
          rows={4}
          value={draft}
          maxLength={CONTENT_MAX}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="상담 내용 (줄바꿈 유지)"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            minHeight: '7.5rem',
            lineHeight: 1.45,
          }}
        />
        {error ? (
          <p style={{ color: '#b00020', margin: '8px 0 0', fontSize: '0.9rem' }} role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="filter-button"
          disabled={saving}
          style={{ marginTop: 10, ...compactBtn }}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </form>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', margin: '12px 0' }} />

      {loading && rows.length === 0 ? (
        <p className="customer-form-history__status">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="customer-form-history__status">등록된 상담이 없습니다.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rows.map((r, idx) => {
            const { dateLabel, text } = parseConsultationStoredBody(r.body, r.createdAt)
            return (
              <li
                key={r.id}
                ref={idx === 0 ? latestRef : undefined}
                style={{
                  borderBottom: '1px solid rgba(0,0,0,0.08)',
                  padding: '12px 0',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    flexShrink: 0,
                    minWidth: '7.5rem',
                  }}
                >
                  ● {dateLabel}
                </div>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.95rem',
                    wordBreak: 'break-word',
                  }}
                >
                  {text || '—'}
                </div>
                <button
                  type="button"
                  aria-label="상담 삭제"
                  title="삭제"
                  style={{
                    flexShrink: 0,
                    padding: '2px 8px',
                    fontSize: '1.1rem',
                    lineHeight: 1,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    opacity: 0.8,
                  }}
                  onClick={() => void onDelete(r)}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {hasMore ? (
        <button
          type="button"
          className="filter-button"
          style={{ marginTop: 10, ...compactBtn }}
          disabled={loading}
          onClick={() => void fetchPage(rows.length, true)}
        >
          {loading ? '불러오는 중…' : '이전 상담 더 보기'}
        </button>
      ) : null}
    </div>
  )
}
