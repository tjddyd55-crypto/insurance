import { useEffect, useState } from 'react'
import './customer-app-news-phone-preview.css'

function formatKrPhoneDisplay(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (!digits) {
    return ''
  }
  if (digits.startsWith('02') && digits.length >= 9) {
    return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return digits
}

type Props = {
  agentName: string
  /** 저장된 휴대폰 번호(숫자·하이픈 혼용 가능) */
  agentPhoneRaw: string | null
  /** 미리보기 슬라이드에 넣을 이미지 URL(업로드 프리뷰·CDN) */
  imageUrls: string[]
  /** 고객앱 홈 하단 CTA·바텀 네비를 함께 표시(전체소식지 PC 미리보기용) */
  showHomeChrome?: boolean
}

export default function CustomerAppNewsPhonePreview({
  agentName,
  agentPhoneRaw,
  imageUrls,
  showHomeChrome = false,
}: Props) {
  const [slide, setSlide] = useState(0)
  const formatted = formatKrPhoneDisplay(agentPhoneRaw)
  const digits = (agentPhoneRaw ?? '').replace(/\D/g, '')
  const count = imageUrls.length

  useEffect(() => {
    setSlide(0)
  }, [imageUrls])

  useEffect(() => {
    if (slide >= count && count > 0) {
      setSlide(count - 1)
    }
  }, [count, slide])

  const showPrev = () => setSlide((i) => (count <= 0 ? 0 : i <= 0 ? count - 1 : i - 1))
  const showNext = () => setSlide((i) => (count <= 0 ? 0 : i >= count - 1 ? 0 : i + 1))

  const identityLabel = [agentName.trim() || '담당 설계사', formatted || '전화번호 미등록'].join(' · ')

  return (
    <aside className="customer-app-news-phone-preview" aria-label="고객앱 화면 미리보기">
      <div className="customer-app-news-phone-preview__chassis">
        <header className="customer-app-news-phone-preview__header">
          <div className="customer-app-news-phone-preview__identity" title={identityLabel}>
            {identityLabel}
          </div>
          <div className="customer-app-news-phone-preview__header-actions">
            {digits ? (
              <a className="customer-app-news-phone-preview__mini-btn" href={`tel:${digits}`}>
                전화
              </a>
            ) : (
              <span className="customer-app-news-phone-preview__mini-btn customer-app-news-phone-preview__mini-btn--disabled">
                전화
              </span>
            )}
            <span className="customer-app-news-phone-preview__mini-btn customer-app-news-phone-preview__mini-btn--ghost">
              닫기
            </span>
          </div>
        </header>

        <div className="customer-app-news-phone-preview__stage">
          {count === 0 ? (
            <div className="customer-app-news-phone-preview__empty">이미지를 업로드하면 여기에 표시됩니다.</div>
          ) : (
            <>
              <div className="customer-app-news-phone-preview__slide" role="img" aria-label={`미리보기 ${slide + 1}/${count}`}>
                <img src={imageUrls[slide]} alt="" />
              </div>
              {count > 1 ? (
                <div className="customer-app-news-phone-preview__nav">
                  <button type="button" onClick={showPrev} aria-label="이전 이미지">
                    ‹
                  </button>
                  <span>
                    {slide + 1} / {count}
                  </span>
                  <button type="button" onClick={showNext} aria-label="다음 이미지">
                    ›
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="customer-app-news-phone-preview__hint">권장 비율 9:16 (세로형)</div>
        {showHomeChrome ? (
          <div className="customer-app-news-phone-preview__home-chrome" aria-hidden>
            <div className="customer-app-news-phone-preview__cta-row">
              <button type="button" className="customer-app-news-phone-preview__cta-pill">
                청구
              </button>
              <button type="button" className="customer-app-news-phone-preview__cta-pill">
                문의하기
              </button>
            </div>
            <nav className="customer-app-news-phone-preview__bottom-tabs">
              <span className="customer-app-news-phone-preview__bottom-tab customer-app-news-phone-preview__bottom-tab--active">
                홈
              </span>
              <span className="customer-app-news-phone-preview__bottom-tab">내 정보</span>
            </nav>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
