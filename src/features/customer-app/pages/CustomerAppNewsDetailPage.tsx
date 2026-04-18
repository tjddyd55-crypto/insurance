import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { getCustomerNewsDetail, markCustomerNewsRead, type CustomerAppNewsDetail } from '../api/customerAppApi'
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

export default function CustomerAppNewsDetailPage() {
  const { newsId } = useParams<{ newsId: string }>()
  const navigate = useNavigate()
  const session = useMemo(() => readCustomerAppSession(), [])
  const [detail, setDetail] = useState<CustomerAppNewsDetail | null>(null)
  const [error, setError] = useState('')
  const hasInvalidNewsId = !newsId

  useEffect(() => {
    if (!session) {
      navigate('/customer-app', { replace: true })
      return
    }
    if (hasInvalidNewsId) {
      return
    }
    let mounted = true
    const run = async () => {
      try {
        const data = await getCustomerNewsDetail(session.appToken, String(newsId))
        await markCustomerNewsRead(session.appToken, String(newsId))
        if (!mounted) {
          return
        }
        setDetail(data)
      } catch (loadError) {
        if (!mounted) {
          return
        }
        setError(loadError instanceof Error ? loadError.message : '소식지 상세를 불러오지 못했습니다.')
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [hasInvalidNewsId, navigate, newsId, session])

  return (
    <CustomerAppShell title="소식지 상세">
      <StatusMessage message={hasInvalidNewsId ? '잘못된 소식지 번호입니다.' : error} tone="error" />
      {!detail ? <div className="text-sm text-[var(--text-secondary)]">불러오는 중…</div> : null}
      {detail ? (
        <article className="space-y-2">
          <h2 className="text-base font-semibold">
            {detail.isPinned ? '[중요] ' : ''}
            {detail.title}
          </h2>
          <div className="text-xs text-[var(--text-secondary)]">{formatDateTime(detail.updatedAt)}</div>
          <div className="text-sm whitespace-pre-wrap">{detail.content}</div>
        </article>
      ) : null}
    </CustomerAppShell>
  )
}
