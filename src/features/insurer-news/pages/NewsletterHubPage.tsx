import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { NewsCard } from '../components/NewsCard'
import { getAllPublishedForGa } from '../services/insurerNews.service'
import type { NewsletterItem } from '../types'

export function NewsletterHubPage() {
  const { user, token } = useAuth()
  const gaCode = user?.gaCode ?? ''
  const navigate = useNavigate()
  const [items, setItems] = useState<NewsletterItem[] | null>(null)

  useEffect(() => {
    if (!gaCode || !token?.trim()) {
      return
    }
    let cancelled = false
    ;(async () => {
      const rows = await getAllPublishedForGa(gaCode, token)
      if (!cancelled) {
        setItems(rows)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gaCode, token])

  if (!gaCode) {
    return null
  }

  if (items === null) {
    return <p className="insurer-news-muted">불러오는 중…</p>
  }

  if (items.length === 0) {
    return (
      <div className="insurer-news-empty" role="status">
        아직 등록된 소식지가 없습니다.
      </div>
    )
  }

  return (
    <div className="news-grid">
      {items.map((item) => (
        <NewsCard key={item.id} item={item} onOpen={() => navigate(`/portal/newsletters/${item.id}`)} />
      ))}
    </div>
  )
}
