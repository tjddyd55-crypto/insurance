import { useState } from 'react'
import { resolveInsurerNewsImageUrl } from '../utils/resolveInsurerNewsImageUrl'

type Props = {
  imageUrls: string[]
  altBase?: string
  /** true면 URL 절대경로 보정·로드 실패 fallback (모바일 상세 등) */
  resolveUrls?: boolean
}

type GallerySlideProps = {
  rawUrl: string
  alt: string
  loading: 'eager' | 'lazy'
  resolveUrls: boolean
}

function GallerySlide({ rawUrl, alt, loading, resolveUrls }: GallerySlideProps) {
  const src = resolveUrls ? resolveInsurerNewsImageUrl(rawUrl) : String(rawUrl ?? '').trim()
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className="insurer-news-gallery__load-failed" role="status">
        <span>이미지를 불러오지 못했습니다.</span>
        {src ? (
          <a href={src} target="_blank" rel="noreferrer">
            새 탭에서 열기
          </a>
        ) : null}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setFailed(true)}
      style={{ width: '100%', display: 'block', marginBottom: 12 }}
    />
  )
}

/** 상세 화면: 슬라이드·인디케이터 없이 이미지를 세로로 나열 */
export function NewsletterImageGallery({
  imageUrls,
  altBase = '소식지 이미지',
  resolveUrls = false,
}: Props) {
  if (imageUrls.length === 0) {
    return null
  }

  return (
    <div className="insurer-news-gallery insurer-news-gallery--stacked" style={{ marginTop: 16 }}>
      {imageUrls.map((url, idx) => (
        <GallerySlide
          key={`${url}-${idx}`}
          rawUrl={url}
          alt={`${altBase} ${idx + 1}`}
          loading={idx === 0 ? 'eager' : 'lazy'}
          resolveUrls={resolveUrls}
        />
      ))}
    </div>
  )
}
