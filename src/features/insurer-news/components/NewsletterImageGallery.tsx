import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const IO_THRESHOLDS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] as const

type Props = {
  imageUrls: string[]
  altBase?: string
}

export function NewsletterImageGallery({ imageUrls, altBase = '소식지 이미지' }: Props) {
  const n = imageUrls.length
  const [activeIndex, setActiveIndex] = useState(0)
  const imageRefs = useRef<(HTMLDivElement | null)[]>([])
  const ratioRef = useRef<number[]>([])
  const scrollLockUntilRef = useRef(0)

  useEffect(() => {
    setActiveIndex(0)
    ratioRef.current = imageUrls.map(() => 0)
  }, [imageUrls])

  useLayoutEffect(() => {
    if (n === 0) {
      return
    }
    ratioRef.current = imageUrls.map((_, i) => ratioRef.current[i] ?? 0)
    while (ratioRef.current.length < n) {
      ratioRef.current.push(0)
    }
    ratioRef.current.length = n

    const observer = new IntersectionObserver(
      (entries) => {
        if (performance.now() < scrollLockUntilRef.current) {
          return
        }
        for (const entry of entries) {
          const raw = (entry.target as HTMLElement).dataset.index
          const idx = raw != null ? Number(raw) : NaN
          if (!Number.isFinite(idx) || idx < 0 || idx >= n) {
            continue
          }
          ratioRef.current[idx] = entry.intersectionRatio
        }
        let bestIdx = 0
        let bestRatio = -1
        ratioRef.current.forEach((r, i) => {
          if (r > bestRatio) {
            bestRatio = r
            bestIdx = i
          }
        })
        if (bestRatio > 0) {
          setActiveIndex(bestIdx)
        }
      },
      { root: null, rootMargin: '0px', threshold: [...IO_THRESHOLDS] },
    )

    imageRefs.current.forEach((el, idx) => {
      if (el) {
        el.dataset.index = String(idx)
        observer.observe(el)
      }
    })

    return () => observer.disconnect()
  }, [imageUrls, n])

  const scrollToImage = useCallback(
    (index: number) => {
      if (index < 0 || index >= n) {
        return
      }
      const el = imageRefs.current[index]
      if (!el) {
        return
      }
      setActiveIndex(index)
      scrollLockUntilRef.current = performance.now() + 700
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [n],
  )

  if (n === 0) {
    return (
      <div className="insurer-news-empty" style={{ marginBottom: 16 }}>
        표시할 이미지가 없습니다.
      </div>
    )
  }

  return (
    <div className="insurer-news-gallery insurer-news-gallery--detail">
      {n > 1 ? (
        <nav className="insurer-news-gallery__pager" aria-label="이미지 페이지">
          {imageUrls.map((_, idx) => (
            <button
              key={`p-${idx}`}
              type="button"
              className={`insurer-news-gallery__page-btn${idx === activeIndex ? ' insurer-news-gallery__page-btn--active' : ''}`}
              aria-label={`${idx + 1}번째 이미지로 이동`}
              aria-current={idx === activeIndex ? 'true' : undefined}
              onClick={() => scrollToImage(idx)}
            >
              {idx + 1}
            </button>
          ))}
        </nav>
      ) : null}
      <div className="insurer-news-gallery__slides">
        {imageUrls.map((url, idx) => (
          <div
            key={`${url}-${idx}`}
            ref={(el) => {
              imageRefs.current[idx] = el
            }}
            className={`insurer-news-gallery__slide${n > 1 ? ' insurer-news-gallery__slide--with-pager' : ''}`}
            data-index={idx}
          >
            <img
              className="insurer-news-gallery__scroll-img"
              src={url}
              alt={`${altBase} ${idx + 1}/${n}`}
              loading={idx === 0 ? 'eager' : 'lazy'}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
