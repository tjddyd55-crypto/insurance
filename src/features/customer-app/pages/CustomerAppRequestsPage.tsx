import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { listCustomerClaimRequests } from '../api/customerAppApi'
import CustomerAppShell from '../components/CustomerAppShell'
import { readCustomerAppSession } from '../session/customerAppSession'
import { resolveClaimStatusMeta } from '../utils/claimStatus'

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function CustomerAppRequestsPage() {
  const navigate = useNavigate()
  const session = useMemo(() => readCustomerAppSession(), [])
  const [rows, setRows] = useState<Array<{ id: number; status: string; title: string; submittedAt: string | null; fileCount: number }>>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) {
      navigate('/customer-app', { replace: true })
      return
    }
    let mounted = true
    const run = async () => {
      try {
        const data = await listCustomerClaimRequests(session.appToken)
        if (!mounted) {
          return
        }
        setRows(data)
      } catch (loadError) {
        if (!mounted) {
          return
        }
        setError(loadError instanceof Error ? loadError.message : '요청 내역을 불러오지 못했습니다.')
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [navigate, session])

  return (
    <CustomerAppShell title="요청 내역">
      <StatusMessage message={error} tone="error" />
      {rows.length === 0 ? <div className="text-sm text-[var(--text-secondary)]">요청 내역이 없습니다.</div> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-[var(--border-default)] p-2">
            <div className="text-sm font-medium">{row.title || '(제목 없음)'}</div>
            <div className="text-xs text-[var(--text-secondary)]">
              첨부 {row.fileCount}개 · {formatDateTime(row.submittedAt)}
            </div>
            <span
              className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${resolveClaimStatusMeta(row.status).className}`}
            >
              {resolveClaimStatusMeta(row.status).label}
            </span>
            <Link to={`/customer-app/requests/${row.id}`} className="text-xs text-blue-600 mt-1 inline-block">
              상세 보기
            </Link>
          </li>
        ))}
      </ul>
    </CustomerAppShell>
  )
}
