import { useState } from 'react'
import {
  ADVISOR_PROFILE_THEME_LABELS,
  ADVISOR_PROFILE_THEMES,
  type AdvisorProfileTheme,
} from '../profileTheme'
import { AdvisorProfileHero } from './heroes/AdvisorProfileHero'
import type { AdvisorProfileHeroProps } from './heroes/advisorProfileHeroTypes'
import { buildHeroPreviewProps } from './heroes/buildHeroPreviewProps'

type PreviewSource = Omit<
  AdvisorProfileHeroProps,
  'actionBarTheme' | 'onPhoneClick' | 'onKakaoClick' | 'onConsultClick' | 'onShareClick'
>

type Props = {
  value: AdvisorProfileTheme
  onChange: (theme: AdvisorProfileTheme) => void
  previewSource: PreviewSource
  disabled?: boolean
}

function ThemeLivePreview({ theme, previewSource }: { theme: AdvisorProfileTheme; previewSource: PreviewSource }) {
  const heroProps = buildHeroPreviewProps({
    displayName: previewSource.displayName,
    titleSuffix: previewSource.titleSuffix,
    profilePhotoUrl: previewSource.profilePhotoUrl,
    affiliationLine: previewSource.affiliationLine,
    officeLine: previewSource.officeLine,
    headline: previewSource.headline,
    publicTags: previewSource.publicTags,
    phoneNumber: previewSource.phoneNumber,
    kakaoLink: previewSource.kakaoLink,
    allowConsultation: previewSource.allowConsultation,
    actionBarTheme: theme,
  })

  return (
    <div className="pap-theme-picker__live-preview" aria-hidden>
      <div className={`pap-theme-picker__live-scale pap-page--fc pap-page-theme--${theme}`}>
        <AdvisorProfileHero theme={theme} {...heroProps} />
      </div>
    </div>
  )
}

export function AdvisorMobileCardThemePicker({ value, onChange, previewSource, disabled }: Props) {
  const [modalTheme, setModalTheme] = useState<AdvisorProfileTheme | null>(null)

  const modalProps =
    modalTheme != null
      ? buildHeroPreviewProps({
          displayName: previewSource.displayName,
          titleSuffix: previewSource.titleSuffix,
          profilePhotoUrl: previewSource.profilePhotoUrl,
          affiliationLine: previewSource.affiliationLine,
          officeLine: previewSource.officeLine,
          headline: previewSource.headline,
          publicTags: previewSource.publicTags,
          phoneNumber: previewSource.phoneNumber,
          kakaoLink: previewSource.kakaoLink,
          allowConsultation: previewSource.allowConsultation,
          actionBarTheme: modalTheme,
        })
      : null

  return (
    <>
      <div className="pap-theme-picker" role="radiogroup" aria-label="모바일 명함 디자인">
        {ADVISOR_PROFILE_THEMES.map((theme) => {
          const meta = ADVISOR_PROFILE_THEME_LABELS[theme]
          const selected = value === theme
          return (
            <div
              key={theme}
              className={`pap-theme-picker__card${selected ? ' pap-theme-picker__card--selected' : ''}`}
            >
              {selected ? <span className="pap-theme-picker__check" aria-hidden>✓</span> : null}
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                className="pap-theme-picker__select"
                onClick={() => onChange(theme)}
              >
                <ThemeLivePreview theme={theme} previewSource={previewSource} />
                <span className="pap-theme-picker__title">{meta.title}</span>
                <span className="pap-theme-picker__subtitle">{meta.subtitle}</span>
                {selected ? <span className="pap-theme-picker__selected-label">선택됨</span> : null}
              </button>
              <button
                type="button"
                className="pap-theme-picker__preview-btn"
                disabled={disabled}
                onClick={() => setModalTheme(theme)}
              >
                390px 미리보기
              </button>
            </div>
          )
        })}
      </div>

      {modalTheme && modalProps ? (
        <div className="pap-theme-preview-modal" role="dialog" aria-modal="true" aria-label="명함 미리보기">
          <button type="button" className="pap-theme-preview-modal__backdrop" aria-label="닫기" onClick={() => setModalTheme(null)} />
          <div className="pap-theme-preview-modal__panel">
            <div className="pap-theme-preview-modal__toolbar">
              <strong>{ADVISOR_PROFILE_THEME_LABELS[modalTheme].title} 미리보기</strong>
              <button type="button" className="pap-btn pap-btn--secondary" onClick={() => setModalTheme(null)}>
                닫기
              </button>
            </div>
            <div className={`pap-theme-preview-modal__viewport pap-page--fc pap-page-theme--${modalTheme}`}>
              <AdvisorProfileHero theme={modalTheme} {...modalProps} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
