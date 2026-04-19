import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { StatusMessage } from '../../../components/feedback'
import { FormButton } from '../../../components/form'
import { NewsletterList } from '../../insurer-news/components/NewsletterList'
import type { NewsletterItem } from '../../insurer-news/types'
import {
  getCustomerNewsDetail,
  listCustomerNewsByScope,
  markCustomerNewsRead,
  type CustomerAppNewsDetail,
} from '../api/customerAppApi'
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
  const location = useLocation()
  const navigate = useNavigate()
  const session = useMemo(() => readCustomerAppSession(), [])
  const isPersonalMode = location.pathname.includes('/customer-app/news/personal')
  const [rows, setRows] = useState<
    Array<{
      id: string
      title: string
      summary: string
      updatedAt: string | null
      isRead: boolean
      isPinned: boolean
      heroImageUrl?: string | null
    }>
  >([])
  const [error, setError] = useState('')
  const [selectedItem, setSelectedItem] = useState<NewsletterItem | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<CustomerAppNewsDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [zoom, setZoom] = useState(1)
  const openRequestIdRef = useRef(0)

  const closeModal = useCallback(() => {
    openRequestIdRef.current += 1
    setSelectedItem(null)
    setSelectedDetail(null)
    setDetailLoading(false)
    setDetailError('')
    setZoom(1)
  }, [])

  useEffect(() => {
    if (!session) {
      navigate('/customer-app', { replace: true })
      return
    }
    let mounted = true
    const run = async () => {
      try {
        const data = await listCustomerNewsByScope(session.appToken, isPersonalMode ? 'personal' : 'all')
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
  }, [isPersonalMode, navigate, session])

  const pageTitle = isPersonalMode ? '개인소식지' : '전체소식지'
  const emptyMessage = isPersonalMode ? '표시할 개인 소식지가 없습니다.' : '표시할 소식지가 없습니다.'
  const newsletterItems = useMemo<NewsletterItem[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        gaCode: 'customer-app',
        insurerCode: 'customer-news',
        insurerName: pageTitle,
        insurerSlug: isPersonalMode ? 'personal' : 'all',
        title: row.title,
        summary: row.summary,
        heroImageUrl: row.heroImageUrl ?? null,
        publishedAt: row.updatedAt ?? new Date().toISOString(),
        status: 'PUBLISHED',
        hasImages: Boolean(row.heroImageUrl),
        hasPdf: false,
        hasTextBody: Boolean(row.summary?.trim()),
      })),
    [isPersonalMode, pageTitle, rows],
  )

  return (
    <CustomerAppShell title={pageTitle}>
      <StatusMessage message={error} tone="error" />
      {rows.length > 0 ? (
        <div className="text-xs text-[var(--text-secondary)]">
          {isPersonalMode ? '개별로 전달된 소식지만 표시됩니다.' : '전체 공지 소식지가 표시됩니다.'}
        </div>
      ) : null}
      <NewsletterList
        items={newsletterItems}
        emptyMessage={emptyMessage}
        onOpenItem={(id) => {
          if (!session) {
            return
          }
          const picked = newsletterItems.find((item) => item.id === id) ?? null
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
              const detail = await getCustomerNewsDetail(session.appToken, id)
              await markCustomerNewsRead(session.appToken, id)
              if (openRequestIdRef.current !== requestId) {
                return
              }
              setRows((prev) => prev.map((row) => (row.id === id ? { ...row, isRead: true } : row)))
              setSelectedDetail(detail)
            } catch (loadError) {
              if (openRequestIdRef.current !== requestId) {
                return
              }
              setDetailError(loadError instanceof Error ? loadError.message : '소식지 상세를 불러오지 못했습니다.')
            } finally {
              if (openRequestIdRef.current === requestId) {
                setDetailLoading(false)
              }
            }
          })()
        }}
      />
      {rows.length > 0 ? (
        <div className="text-xs text-[var(--text-secondary)]">
          최신 업데이트: {formatDateTime(rows[0]?.updatedAt ?? null)}
        </div>
      ) : null}
      {selectedItem ? (
        <div className="customer-news-modal" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="customer-news-modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <FormButton
                htmlType="button"
                variant="action"
                className="filter-button customer-news-modal-control"
                onClick={() => setZoom((value) => Math.min(value + 0.2, 3))}
              >
                확대
              </FormButton>
              <FormButton
                htmlType="button"
                variant="action"
                className="filter-button customer-news-modal-control"
                onClick={() => setZoom((value) => Math.max(value - 0.2, 0.5))}
              >
                축소
              </FormButton>
              <FormButton
                htmlType="button"
                variant="action"
                className="filter-button close-btn customer-news-modal-close"
                onClick={closeModal}
              >
                닫기
              </FormButton>
            </div>
            <div className="modal-body">
              {detailLoading ? <div className="modal-text">소식지 상세를 불러오는 중입니다…</div> : null}
              {!detailLoading && detailError ? <div className="modal-text">{detailError}</div> : null}
              {!detailLoading && !detailError ? (
                <div className="news-detail-scroll">
                  <div className="news-detail-zoom-scope" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                    {(selectedDetail?.content?.trim() || selectedItem.summary?.trim()) ? (
                      <div className="news-text">{selectedDetail?.content?.trim() || selectedItem.summary}</div>
                    ) : null}
                    {(() => {
                      const imageUrls =
                        selectedDetail?.attachments
                          ?.filter((attachment) => attachment.kind === 'image')
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((attachment) => attachment.url) ?? []
                      const finalUrls = imageUrls.length
                        ? imageUrls
                        : selectedDetail?.heroImageUrl
                          ? [selectedDetail.heroImageUrl]
                          : selectedItem.heroImageUrl
                            ? [selectedItem.heroImageUrl]
                            : []
                      return finalUrls.map((url) => <img key={url} src={url} alt="" />)
                    })()}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </CustomerAppShell>
  )
}
