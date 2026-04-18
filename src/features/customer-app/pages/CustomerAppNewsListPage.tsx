import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { listCustomerNews } from '../api/customerAppApi'
import CustomerAppShell from '../components/CustomerAppShell'
import { readCustomerAppSession } from '../session/customerAppSession'

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

export default function CustomerAppNewsListPage() {
  const navigate = useNavigate()
  const session = useMemo(() => readCustomerAppSession(), [])
  const [rows, setRows] = useState<Array<{ id: string; title: string; summary: string; updatedAt: string | null; isRead: boolean; isPinned: boolean }>>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) {
      navigate('/customer-app', { replace: true })
      return
    }
    let mounted = true
    const run = async () => {
      try {
        const data = await listCustomerNews(session.appToken)
        if (!mounted) {
          return
        }
        setRows(data)
      } catch (loadError) {
        if (!mounted) {
          return
        }
        setError(loadError instanceof Error ? loadError.message : '소식지 목록을 불러오지 못했습니다.')
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [navigate, session])

  return (
    <CustomerAppShell title="소식지">
      <StatusMessage message={error} tone="error" />
      {rows.length === 0 ? <div className="text-sm text-[var(--text-secondary)]">표시할 소식지가 없습니다.</div> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-[var(--border-default)] p-2">
            <div className="text-sm font-medium">
              {row.isPinned ? '[중요] ' : ''}
              {row.title}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">{row.summary}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              {row.isRead ? '읽음' : '안읽음'} · {formatDateTime(row.updatedAt)}
            </div>
            <Link to={`/customer-app/news/${row.id}`} className="text-xs text-blue-600 mt-1 inline-block">
              상세 보기
            </Link>
          </li>
        ))}
      </ul>
    </CustomerAppShell>
  )
}
