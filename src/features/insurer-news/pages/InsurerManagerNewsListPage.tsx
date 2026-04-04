import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageBackButton } from '../../../components/common/PageBackButton'
import { useAuth } from '../../auth/AuthProvider'
import { NewsletterList } from '../components/NewsletterList'
import { getNewslettersForInsurerManagerCompany } from '../services/insurerNews.service'
import type { NewsletterItem } from '../types'

export function InsurerManagerNewsListPage() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const gaCode = user?.gaCode ?? ''
  const companyId = user?.companyId
  const [items, setItems] = useState<NewsletterItem[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token?.trim() || !gaCode || companyId == null) {
      return
    }
    let cancelled = false
    ;(async () => {
      setError('')
      try {
        const rows = await getNewslettersForInsurerManagerCompany(token, gaCode, companyId)
        if (!cancelled) {
          setItems(rows)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, gaCode, companyId])

  if (!gaCode || companyId == null) {
    return (
      <main className="page page--with-back insurer-news-page">
        <PageBackButton />
        <div className="insurer-news-empty">원수사 담당자 계정(소속 회사 정보 포함)으로 로그인한 후 이용할 수 있습니다.</div>
      </main>
    )
  }

  return (
    <main className="page page--with-back insurer-news-page">
      <PageBackButton />
      <header className="page-header" style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 8 }}>원수사 소식지 조회</h1>
        <p className="insurer-news-muted">소속 원수사에 등록된 소식지만 표시됩니다.</p>
      </header>
      {error ? <div className="insurer-news-empty">{error}</div> : null}
      <NewsletterList
        items={items}
        emptyMessage="등록된 소식지가 없습니다."
        onOpenItem={(id) => navigate(`/insurer/news/${id}`)}
      />
    </main>
  )
}
