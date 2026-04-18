import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { FormButton } from '../../../components/form'
import { getCustomerAppMe, listCustomerClaimRequests, listCustomerNews } from '../api/customerAppApi'
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

export default function CustomerAppHomePage() {
  const navigate = useNavigate()
  const session = readCustomerAppSession()
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({
    me: '',
    latestRequest: '',
    latestNews: '',
  })

  useEffect(() => {
    if (!session) {
      navigate('/customer-app', { replace: true })
      return
    }
    let mounted = true
    const run = async () => {
      try {
        const [me, requests, news] = await Promise.all([
          getCustomerAppMe(session.appToken),
          listCustomerClaimRequests(session.appToken),
          listCustomerNews(session.appToken),
        ])
        if (!mounted) {
          return
        }
        setSummary({
          me: `${me.customerName} · 담당 ${me.agentName}`,
          latestRequest:
            requests.length > 0
              ? `${requests[0].title || '(제목 없음)'} / ${formatDateTime(requests[0].submittedAt)}`
              : '아직 요청 내역이 없습니다.',
          latestNews:
            news.length > 0 ? `${news[0].title} / ${formatDateTime(news[0].updatedAt)}` : '아직 소식지가 없습니다.',
        })
      } catch (loadError) {
        if (!mounted) {
          return
        }
        setError(loadError instanceof Error ? loadError.message : '홈 정보를 불러오지 못했습니다.')
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [navigate, session])

  return (
    <CustomerAppShell title="홈">
      <StatusMessage message={error} tone="error" />
      <div className="text-sm text-[var(--text-secondary)]">{summary.me}</div>
      <div className="space-y-1 text-sm">
        <div>
          <span className="font-medium">최근 요청</span> {summary.latestRequest}
        </div>
        <div>
          <span className="font-medium">최근 소식지</span> {summary.latestNews}
        </div>
      </div>
      <FormButton htmlType="button" variant="primary" onClick={() => navigate('/customer-app/requests/new')}>
        청구 요청하기
      </FormButton>
    </CustomerAppShell>
  )
}
