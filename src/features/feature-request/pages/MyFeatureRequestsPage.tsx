import { useCallback, useEffect, useState } from 'react'
import { listMyFeatureRequests, type FeatureRequestStatus, type MyFeatureRequestRow } from '../../auth/authApi'
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

export default function MyFeatureRequestsPage() {
  const { token } = useAuth()
  const [rows, setRows] = useState<MyFeatureRequestRow[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!token?.trim()) {
      return
    }
    setError('')
    try {
      const list = await listMyFeatureRequests(token)
      setRows(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <main className="page page--with-back">
      <PageBackButton />
      <header className="page-header">
        <h1>내 기능 요청</h1>
        <p>{error || '최근 요청부터 표시됩니다.'}</p>
      </header>

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
                  <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {formatDate(r.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
