import { FormSelect } from '../../../components/form'
import { useCallback, useEffect, useState } from 'react'
import {
  listFeatureRequestsAdmin,
  updateFeatureRequestStatus,
  type FeatureRequestAdminRow,
  type FeatureRequestStatus,
} from '../../auth/authApi'
import { useAuth } from '../../auth/AuthProvider'

const STATUS_OPTIONS: { value: FeatureRequestStatus; label: string }[] = [
  { value: 'pending', label: '대기 (pending)' },
  { value: 'reviewed', label: '검토됨 (reviewed)' },
  { value: 'done', label: '완료 (done)' },
]

function formatDate(iso: string): string {
  if (!iso) {
    return '—'
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return iso.slice(0, 10)
  }
  return d.toISOString().slice(0, 10)
}

export default function FeatureRequestsAdminPage() {
  const { user, token } = useAuth()
  const [rows, setRows] = useState<FeatureRequestAdminRow[]>([])
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!token?.trim() || user?.role !== 'SUPER_ADMIN') {
      return
    }
    setError('')
    try {
      const list = await listFeatureRequestsAdmin(token)
      setRows(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    }
  }, [token, user?.role])

  useEffect(() => {
    void load()
  }, [load])

  const onStatusChange = async (id: number, status: FeatureRequestStatus) => {
    if (!token?.trim()) {
      return
    }
    setUpdatingId(id)
    setError('')
    try {
      await updateFeatureRequestStatus(token, id, status)
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    } catch (e) {
      setError(e instanceof Error ? e.message : '상태 변경에 실패했습니다.')
    } finally {
      setUpdatingId(null)
    }
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <main className="page page--with-back">
        <header className="page-header">
          <h1>기능 요청 관리</h1>
          <p>전체 관리자만 접근할 수 있습니다.</p>
        </header>
      </main>
    )
  }

  return (
    <main className="page page--with-back">
      <header className="page-header">
        <h1>기능 요청 관리</h1>
        <p>{error || `총 ${rows.length}건 (최근 500건)`}</p>
      </header>

      <div
        className="card"
        style={{
          maxWidth: 'none',
          margin: 0,
          padding: 0,
          overflowX: 'auto',
        }}
      >
        <table
          style={{
            width: '100%',
            minWidth: 840,
            borderCollapse: 'collapse',
            fontSize: '14px',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>GA</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>아이디</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>제목</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>내용</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>상태</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>생성일</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '20px 12px', color: 'var(--text-sub)' }}>
                  등록된 요청이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{r.ga_name}</td>
                  <td style={{ padding: '10px 8px', wordBreak: 'break-all' }}>{r.username}</td>
                  <td style={{ padding: '10px 8px', maxWidth: 160, wordBreak: 'break-word' }}>
                    {r.title || '—'}
                  </td>
                  <td style={{ padding: '10px 8px', maxWidth: 280, wordBreak: 'break-word' }}>
                    {r.content}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <FormSelect
                      value={r.status}
                      disabled={updatingId === r.id}
                      onChange={(e) => {
                        void onStatusChange(r.id, e.target.value as FeatureRequestStatus)
                      }}
                      aria-label={`${r.id} 상태`}
                      options={STATUS_OPTIONS}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums' }}>
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
