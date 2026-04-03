import { useCallback, useEffect, useState } from 'react'

type Props = {
  imageUrls: string[]
  altBase?: string
}

export function NewsletterImageGallery({ imageUrls, altBase = '소식지 이미지' }: Props) {
  const [index, setIndex] = useState(0)
  const n = imageUrls.length

  useEffect(() => {
    setIndex(0)
  }, [imageUrls])

  const go = useCallback(
    (delta: number) => {
      if (n === 0) {
        return
      }
      setIndex((i) => (i + delta + n) % n)
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

  const url = imageUrls[index]

  return (
    <div className="insurer-news-gallery" aria-roledescription="carousel">
      <div className="insurer-news-gallery__viewport">
        <img
          className="insurer-news-gallery__img"
          src={url}
          alt={`${altBase} ${index + 1}/${n}`}
        />
      </div>
      {n > 1 ? (
        <>
          <button
            type="button"
            className="insurer-news-gallery__nav insurer-news-gallery__nav--prev"
            aria-label="이전 이미지"
            onClick={() => go(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="insurer-news-gallery__nav insurer-news-gallery__nav--next"
            aria-label="다음 이미지"
            onClick={() => go(1)}
          >
            ›
          </button>
          <div className="insurer-news-gallery__dots" role="tablist" aria-label="이미지 선택">
            {imageUrls.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`insurer-news-gallery__dot${i === index ? ' insurer-news-gallery__dot--on' : ''}`}
                aria-label={`${i + 1}번째 이미지`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
