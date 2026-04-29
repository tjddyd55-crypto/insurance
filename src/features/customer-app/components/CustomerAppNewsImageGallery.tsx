import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'

type Props = {
  imageUrls: string[]
  altBase?: string
  /** 상위에서 주입하는 추가 클래스 (예: 모달 전용 여백) */
  className?: string
}

const SWIPE_PX = 48

export default function CustomerAppNewsImageGallery({ imageUrls, altBase = '소식 이미지', className = '' }: Props) {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const urls = imageUrls.filter(Boolean)
  const n = urls.length
  const urlsSignature = urls.join('|')

  useEffect(() => {
    setIndex(0)
  }, [urlsSignature])

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

  return (
    <div className={rootClass} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="customer-app-news-gallery__viewport">
        <div
          className="customer-app-news-gallery__track"
          style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
        >
          {urls.map((url, idx) => (
            <div key={`${url}-${idx}`} className="customer-app-news-gallery__slide">
              <img src={url} alt={`${altBase} ${idx + 1}`} loading={idx === 0 ? 'eager' : 'lazy'} decoding="async" />
            </div>
          ))}
        </div>
      </div>

      {n > 1 ? (
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
          <div className="customer-app-news-gallery__meta" aria-live="polite">
            <span className="customer-app-news-gallery__counter">
              {index + 1} / {n}
            </span>
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
        </>
      ) : null}
    </div>
  )
}
