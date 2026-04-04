import { type FormEvent, useCallback, useEffect, useState } from 'react'
import {
  listMyFeatureRequests,
  submitFeatureRequest,
  type FeatureRequestStatus,
  type MyFeatureRequestRow,
} from '../../auth/authApi'
import { useAuth } from '../../auth/AuthProvider'
import { PageBackButton } from '../../../components/common/PageBackButton'

function formatDate(iso: string): string {
  if (!iso) {
    return '—'
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return iso.slice(0, 10)
  }
  return d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

function statusLabel(status: FeatureRequestStatus): string {
  if (status === 'done') {
    return '완료'
  }
  return '대기'
}

export default function FeatureRequestPage() {
  const { token } = useAuth()
  const [mode, setMode] = useState<'list' | 'create'>('list')
  const [rows, setRows] = useState<MyFeatureRequestRow[]>([])
  const [listError, setListError] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [statusText, setStatusText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadList = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setListError('')
    try {
      const list = await listMyFeatureRequests(token)
      setRows(list)
    } catch (e) {
      setListError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    }
  }, [token])

  useEffect(() => {
    if (mode === 'list') {
      void loadList()
    }
  }, [mode, loadList])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token?.trim()) {
      setStatusText('로그인이 필요합니다.')
      return
    }
    const trimmed = content.trim()
    if (!trimmed) {
      setStatusText('내용을 입력해 주세요.')
      return
    }
    setStatusText('')
    setIsSubmitting(true)
    try {
      await submitFeatureRequest(token, { title: title.trim(), content: trimmed })
      setTitle('')
      setContent('')
      setStatusText('')
      setMode('list')
      void loadList()
    } catch (err) {
      setStatusText(err instanceof Error ? err.message : '전송에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page page--with-back">
      <PageBackButton />
      <header className="page-header">
        <h1>추가기능 요청하기</h1>
        <p>
          {mode === 'list'
            ? listError || '요청 목록입니다. 새 요청은 「작성하기」에서 등록합니다.'
            : statusText ||
              '필요하신 기능이나 개선 사항을 남겨 주세요. 소속 GA·계정 정보와 함께 저장됩니다.'}
        </p>
      </header>

      {mode === 'list' ? (
        <>
          <section className="card auth-card" style={{ maxWidth: 720, margin: '0 auto 16px' }}>
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                setListError('')
                setMode('create')
              }}
            >
              작성하기
            </button>
          </section>

          <div
            className="card"
            style={{
              maxWidth: 720,
              margin: '0 auto',
              padding: 0,
              overflowX: 'auto',
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: 280,
                borderCollapse: 'collapse',
                fontSize: '14px',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>제목</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>내용</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    상태
                  </th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    작성일
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '20px 12px', color: 'var(--text-sub)' }}>
                      등록된 요청이 없습니다.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      <td style={{ padding: '10px 12px', wordBreak: 'break-word' }}>{r.title || '(제목 없음)'}</td>
                      <td style={{ padding: '10px 8px', wordBreak: 'break-word' }}>{r.content}</td>
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{statusLabel(r.status)}</td>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatDate(r.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <section className="card auth-card" style={{ maxWidth: 560, margin: '0 auto' }}>
          <form className="auth-form" onSubmit={(ev) => void handleSubmit(ev)}>
            <label className="field">
              <span className="field__label">요청 제목 (선택)</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="한 줄로 요약해 주세요. 비워 두면 내용 앞부분이 제목으로 저장됩니다."
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span className="field__label">내용</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                required
                maxLength={8000}
                placeholder="예: OO 화면에서 검색 필터를 추가해 주세요."
                style={{ minHeight: 160, resize: 'vertical' }}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="button button--primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? '전송 중…' : '저장'}
              </button>
              <button
                type="button"
                className="button button--secondary"
                disabled={isSubmitting}
                onClick={() => {
                  setStatusText('')
                  setMode('list')
                }}
              >
                취소
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  )
}
