import { useCallback, useRef, useState, type TouchEvent } from 'react'
import { resolveAbsoluteApiUrl } from '../../../lib/apiClient'

export type CustomerAppNewsGallerySlideAction = {
  openUrl: string
  downloadUrl?: string
  fileName?: string
}

type Props = {
  imageUrls: string[]
  altBase?: string
  /** 상위에서 주입하는 추가 클래스 (예: 모달 전용 여백) */
  className?: string
  /** true면 이미지 1장일 때도 1/N·dot 표시 (홈·미리보기) */
  alwaysShowPager?: boolean
  /** false면 "1 / N" 숫자 숨김·dot만 (고객앱 홈 등) */
  showSlideCounter?: boolean
  /** 슬라이드 이미지 탭 시 (전체화면 등). 지정 시 슬라이드가 버튼으로 감싸짐 */
  onRequestFullscreen?: (index: number) => void
  /** 이미지 로드 실패 시 열기/다운로드 fallback (imageUrls 와 동일 순서) */
  slideActions?: CustomerAppNewsGallerySlideAction[]
  appToken?: string
}

const SWIPE_PX = 48

async function fetchGallerySlideBlob(url: string, appToken: string): Promise<Blob> {
  const href = resolveAbsoluteApiUrl(url)
  const hasAccessToken = href.includes('accessToken=')
  const response = await fetch(href, {
    method: 'GET',
    headers: hasAccessToken ? {} : { Authorization: `Bearer ${appToken.trim()}` },
  })
  if (!response.ok) {
    throw new Error('첨부파일을 불러오지 못했습니다.')
  }
  return response.blob()
}

function GallerySlideFallback({
  action,
  appToken,
  altBase,
  index,
}: {
  action: CustomerAppNewsGallerySlideAction
  appToken: string
  altBase: string
  index: number
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (mode: 'open' | 'download') => {
    setBusy(true)
    setError('')
    try {
      const sourceUrl =
        mode === 'download'
          ? String(action.downloadUrl ?? action.openUrl ?? '').trim()
          : String(action.openUrl ?? '').trim()
      if (!sourceUrl) {
        throw new Error('첨부파일 주소가 없습니다.')
      }
      const blob = await fetchGallerySlideBlob(sourceUrl, appToken)
      const objectUrl = URL.createObjectURL(blob)
      if (mode === 'open') {
        window.open(objectUrl, '_blank', 'noopener,noreferrer')
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
        return
      }
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = action.fileName || 'download'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '첨부파일을 열 수 없습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="customer-app-news-gallery__broken" role="group" aria-label={`${altBase} ${index + 1}`}>
      <p className="customer-app-news-gallery__broken-text">이미지를 불러오지 못했습니다.</p>
      {error ? (
        <p className="customer-app-news-gallery__broken-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="customer-app-news-gallery__broken-actions">
        <button
          type="button"
          className="filter-button customer-app-news-attachments__btn"
          disabled={busy}
          onClick={() => void run('open')}
        >
          {busy ? '처리 중…' : '열기'}
        </button>
        <button
          type="button"
          className="filter-button customer-app-news-attachments__btn"
          disabled={busy}
          onClick={() => void run('download')}
        >
          다운로드
        </button>
      </div>
    </div>
  )
}

export default function CustomerAppNewsImageGallery({
  imageUrls,
  altBase = '소식 이미지',
  className = '',
  alwaysShowPager = false,
  showSlideCounter = true,
  onRequestFullscreen,
  slideActions = [],
  appToken = '',
}: Props) {
  const urls = imageUrls.filter(Boolean).map((url) => resolveAbsoluteApiUrl(url))
  const urlsSignature = urls.join('|')

  return (
    <GallerySlides
      key={urlsSignature}
      urls={urls}
      altBase={altBase}
      className={className}
      alwaysShowPager={alwaysShowPager}
      showSlideCounter={showSlideCounter}
      onRequestFullscreen={onRequestFullscreen}
      slideActions={slideActions}
      appToken={appToken}
    />
  )
}

function GallerySlides({
  urls,
  altBase,
  className,
  alwaysShowPager,
  showSlideCounter,
  onRequestFullscreen,
  slideActions,
  appToken,
}: {
  urls: string[]
  altBase: string
  className: string
  alwaysShowPager: boolean
  showSlideCounter: boolean
  onRequestFullscreen?: (index: number) => void
  slideActions: CustomerAppNewsGallerySlideAction[]
  appToken: string
}) {
  const [index, setIndex] = useState(0)
  const [brokenIndices, setBrokenIndices] = useState<Set<number>>(() => new Set())
  const touchStartX = useRef<number | null>(null)
  const n = urls.length

  const markBroken = useCallback((idx: number) => {
    setBrokenIndices((prev) => {
      if (prev.has(idx)) {
        return prev
      }
      const next = new Set(prev)
      next.add(idx)
      return next
    })
  }, [])

  const go = useCallback(
    (dir: -1 | 1) => {
      if (n <= 1) {
        return
      }
      setIndex((prev) => {
        const next = prev + dir
        if (next < 0) {
          return n - 1
        }
        if (next >= n) {
          return 0
        }
        return next
      })
    },
    [n],
  )

  const onTouchStart = useCallback((event: TouchEvent) => {
    touchStartX.current = event.touches[0].clientX
  }, [])

  const onTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (touchStartX.current == null || n <= 1) {
        touchStartX.current = null
        return
      }
      const dx = event.changedTouches[0].clientX - touchStartX.current
      touchStartX.current = null
      if (dx > SWIPE_PX) {
        go(-1)
      } else if (dx < -SWIPE_PX) {
        go(1)
      }
    },
    [go, n],
  )

  if (n === 0) {
    return null
  }

  const rootClass = `customer-app-news-gallery${className ? ` ${className}` : ''}`
  const showArrows = n > 1
  const showMeta = alwaysShowPager ? n >= 1 : n > 1

  const renderSlideContent = (url: string, idx: number) => {
    const action = slideActions[idx]
    if (brokenIndices.has(idx)) {
      if (action && appToken.trim()) {
        return (
          <GallerySlideFallback action={action} appToken={appToken} altBase={altBase} index={idx} />
        )
      }
      return (
        <div className="customer-app-news-gallery__broken" role="group" aria-label={`${altBase} ${idx + 1}`}>
          <p className="customer-app-news-gallery__broken-text">이미지를 불러오지 못했습니다.</p>
        </div>
      )
    }

    const img = (
      <img
        src={url}
        alt={`${altBase} ${idx + 1}`}
        loading={idx === 0 ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => markBroken(idx)}
      />
    )

    if (onRequestFullscreen) {
      return (
        <button
          type="button"
          className="customer-app-news-gallery__slide-btn"
          aria-label={`${altBase} 전체 화면으로 보기 ${idx + 1}`}
          onClick={() => onRequestFullscreen(idx)}
        >
          {img}
        </button>
      )
    }

    return img
  }

  return (
    <div className={rootClass} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="customer-app-news-gallery__viewport">
        <div
          className="customer-app-news-gallery__track"
          style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
        >
          {urls.map((url, idx) => (
            <div key={`${url}-${idx}`} className="customer-app-news-gallery__slide">
              {renderSlideContent(url, idx)}
            </div>
          ))}
        </div>
      </div>

      {showArrows ? (
        <>
          <button
            type="button"
            className="customer-app-news-gallery__nav customer-app-news-gallery__nav--prev"
            aria-label="이전 이미지"
            onClick={() => go(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="customer-app-news-gallery__nav customer-app-news-gallery__nav--next"
            aria-label="다음 이미지"
            onClick={() => go(1)}
          >
            ›
          </button>
        </>
      ) : null}

      {showMeta ? (
        <div className="customer-app-news-gallery__meta" aria-live="polite">
          {showSlideCounter ? (
            <span className="customer-app-news-gallery__counter">
              {index + 1} / {n}
            </span>
          ) : null}
          <div className="customer-app-news-gallery__dots" role="tablist" aria-label="이미지 선택">
            {urls.map((_, i) => (
              <button
                key={String(i)}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${i + 1}번째 이미지 보기`}
                className={`customer-app-news-gallery__dot${i === index ? ' is-active' : ''}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
