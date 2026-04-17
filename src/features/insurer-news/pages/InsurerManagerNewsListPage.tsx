import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormButton } from '../../../components/form'
import useIsMobile from '../../../hooks/useIsMobile'
import { useAuth } from '../../auth/AuthProvider'
import { NewsletterList } from '../components/NewsletterList'
import {
  getAllPublishedForGa,
  getNewsletterDetail,
  getNewsletterDetailForInsurerManager,
  getNewslettersForInsurerManagerCompany,
} from '../services/insurerNews.service'
import type { NewsChannel, NewsletterDetail, NewsletterItem } from '../types'

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
  const [selectedDetail, setSelectedDetail] = useState<NewsletterDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [zoom, setZoom] = useState(1)
  const openRequestIdRef = useRef(0)

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
          setSelectedDetail(null)
          setDetailLoading(true)
          setDetailError('')
          setZoom(1)
          const requestId = openRequestIdRef.current + 1
          openRequestIdRef.current = requestId
          void (async () => {
            try {
              const detail =
                fetchScope === 'ga'
                  ? await getNewsletterDetail(gaCode, id, token, { channel })
                  : await getNewsletterDetailForInsurerManager(token ?? '', gaCode, companyId ?? 0, id, { channel })
              if (openRequestIdRef.current !== requestId) {
                return
              }
              setSelectedDetail(detail)
              if (!detail) {
                setDetailError('소식지 상세를 불러오지 못했습니다.')
              }
            } catch (e) {
              if (openRequestIdRef.current !== requestId) {
                return
              }
              setDetailError(e instanceof Error ? e.message : '소식지 상세를 불러오지 못했습니다.')
            } finally {
              if (openRequestIdRef.current === requestId) {
                setDetailLoading(false)
              }
            }
          })()
        }}
      />
      {!isMobile && selectedItem ? (
        <div
          className="news-modal"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            openRequestIdRef.current += 1
            setSelectedItem(null)
            setSelectedDetail(null)
            setDetailLoading(false)
            setDetailError('')
          }}
        >
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
              {(selectedDetail?.heroImageUrl || selectedItem.heroImageUrl) ? (
                <a
                  href={selectedDetail?.heroImageUrl || selectedItem.heroImageUrl}
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
                onClick={() => {
                  openRequestIdRef.current += 1
                  setSelectedItem(null)
                  setSelectedDetail(null)
                  setDetailLoading(false)
                  setDetailError('')
                }}
              >
                ✕
              </FormButton>
            </div>

            <div className="modal-body">
              {detailLoading ? <div className="modal-text">소식지 상세를 불러오는 중입니다…</div> : null}
              {!detailLoading && detailError ? <div className="modal-text">{detailError}</div> : null}
              {!detailLoading && !detailError ? (
                <div className="news-detail-scroll">
                  <div className="news-detail-zoom-scope" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                    {(selectedDetail?.bodyText?.trim() || selectedItem.summary?.trim()) ? (
                      <div className="news-text">{selectedDetail?.bodyText?.trim() || selectedItem.summary}</div>
                    ) : null}
                    {(() => {
                      const imageRows =
                        selectedDetail?.attachments
                          ?.filter((a) => a.kind === 'image')
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((a) => a.url) ?? []
                      const imageUrls = imageRows.length
                        ? imageRows
                        : selectedDetail?.heroImageUrl
                          ? [selectedDetail.heroImageUrl]
                          : selectedItem.heroImageUrl
                            ? [selectedItem.heroImageUrl]
                            : []
                      return imageUrls.map((url) => <img key={url} src={url} alt="" />)
                    })()}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
