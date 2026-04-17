import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import { NewsletterList } from '../components/NewsletterList'
import { getAllPublishedForGa, getNewslettersForInsurerManagerCompany } from '../services/insurerNews.service'
import type { NewsChannel, NewsletterItem } from '../types'

export function InsurerManagerNewsListPage({
  channel = 'INSURER',
  title = '원수사 소식지 조회',
  subtitle = '소속 원수사에 등록된 소식지만 표시됩니다.',
  openPathPrefix = '/insurer/news',
  emptyMessage = '등록된 소식지가 없습니다.',
  fetchScope = 'manager',
  noSessionMessage = '원수사 담당자 계정(소속 회사 정보 포함)으로 로그인한 후 이용할 수 있습니다.',
}: {
  channel?: NewsChannel
  title?: string
  subtitle?: string
  openPathPrefix?: string
  emptyMessage?: string
  fetchScope?: 'manager' | 'ga'
  noSessionMessage?: string
}) {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const gaCode = user?.gaCode ?? ''
  const companyId = user?.companyId
  const requiresCompanyScope = fetchScope === 'manager' && channel !== 'LOSS_ADJUSTER'
  const [items, setItems] = useState<NewsletterItem[]>([])
  const [error, setError] = useState('')
  const [selectedItem, setSelectedItem] = useState<NewsletterItem | null>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!token?.trim() || !gaCode || (requiresCompanyScope && companyId == null)) {
      return
    }
    let cancelled = false
    ;(async () => {
      setError('')
      try {
        const rows =
          fetchScope === 'ga'
            ? await getAllPublishedForGa(gaCode, token, { channel })
            : await getNewslettersForInsurerManagerCompany(token, gaCode, companyId ?? 0, { channel })
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
  }, [fetchScope, channel, token, gaCode, companyId, requiresCompanyScope])

  if (!gaCode || (requiresCompanyScope && companyId == null)) {
    return (
      <main className="page page--with-back insurer-news-page">
        <header className="page-header page-header--has-inline-back">
          <div className="page-header__title-row">
            <h1>{title}</h1>
          </div>
        </header>
        <div className="insurer-news-empty">{noSessionMessage}</div>
      </main>
    )
  }

  return (
    <main className="page page--with-back insurer-news-page">
      <header className="page-header page-header--has-inline-back" style={{ marginBottom: 16 }}>
        <div className="page-header__title-row">
          <h1>{title}</h1>
        </div>
        <p className="insurer-news-muted">{subtitle}</p>
      </header>
      {error ? <div className="insurer-news-empty">{error}</div> : null}
      <NewsletterList
        items={items}
        emptyMessage={emptyMessage}
        onOpenItem={(id) => {
          if (isMobile) {
            navigate(`${openPathPrefix}/${id}`)
            return
          }
          const picked = items.find((item) => item.id === id) ?? null
          if (!picked) {
            return
          }
          setSelectedItem(picked)
          setZoom(1)
        }}
      />
      {!isMobile && selectedItem ? (
        <div className="news-modal" role="dialog" aria-modal="true" onClick={() => setSelectedItem(null)}>
          <div className="news-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <FormButton
                htmlType="button"
                variant="action"
                className="filter-button"
                onClick={() => setZoom((v) => Math.min(v + 0.2, 3))}
              >
                ＋
              </FormButton>
              <FormButton
                htmlType="button"
                variant="action"
                className="filter-button"
                onClick={() => setZoom((v) => Math.max(v - 0.2, 0.5))}
              >
                －
              </FormButton>
              {selectedItem.heroImageUrl ? (
                <a
                  href={selectedItem.heroImageUrl}
                  download
                  className="button filter-button download-btn"
                  target="_blank"
                  rel="noreferrer"
                >
                  다운로드
                </a>
              ) : null}
              <FormButton
                htmlType="button"
                variant="action"
                className="filter-button close-btn"
                onClick={() => setSelectedItem(null)}
              >
                ✕
              </FormButton>
            </div>

            <div className="modal-body">
              {selectedItem.heroImageUrl ? (
                <img
                  src={selectedItem.heroImageUrl}
                  alt=""
                  style={{ transform: `scale(${zoom})` }}
                />
              ) : null}
              {selectedItem.summary?.trim() ? (
                <div className="modal-text">{selectedItem.summary}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
