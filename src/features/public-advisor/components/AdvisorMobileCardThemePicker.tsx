import {
  ADVISOR_PROFILE_THEME_LABELS,
  ADVISOR_PROFILE_THEMES,
  type AdvisorProfileTheme,
} from '../profileTheme'

type Props = {
  value: AdvisorProfileTheme
  onChange: (theme: AdvisorProfileTheme) => void
  disabled?: boolean
}

function ThemeMiniPreview({ theme }: { theme: AdvisorProfileTheme }) {
  return (
    <div className={`pap-theme-mini pap-theme-mini--${theme}`} aria-hidden>
      {theme === 'classic' ? (
        <>
          <div className="pap-theme-mini__photo-block" />
          <div className="pap-theme-mini__line pap-theme-mini__line--bold" />
          <div className="pap-theme-mini__line" />
          <div className="pap-theme-mini__actions" />
        </>
      ) : null}
      {theme === 'brand' ? (
        <>
          <div className="pap-theme-mini__brand-top">
            <div className="pap-theme-mini__line pap-theme-mini__line--bold pap-theme-mini__line--light" />
            <div className="pap-theme-mini__line pap-theme-mini__line--light" />
          </div>
          <div className="pap-theme-mini__brand-photo" />
          <div className="pap-theme-mini__line" />
          <div className="pap-theme-mini__actions" />
        </>
      ) : null}
      {theme === 'premium' ? (
        <>
          <div className="pap-theme-mini__premium-photo">
            <div className="pap-theme-mini__premium-overlay">
              <div className="pap-theme-mini__line pap-theme-mini__line--bold pap-theme-mini__line--light" />
              <div className="pap-theme-mini__line pap-theme-mini__line--light" />
            </div>
          </div>
          <div className="pap-theme-mini__actions" />
        </>
      ) : null}
    </div>
  )
}

export function AdvisorMobileCardThemePicker({ value, onChange, disabled }: Props) {
  return (
    <div className="pap-theme-picker" role="radiogroup" aria-label="모바일 명함 디자인">
      {ADVISOR_PROFILE_THEMES.map((theme) => {
        const meta = ADVISOR_PROFILE_THEME_LABELS[theme]
        const selected = value === theme
        return (
          <button
            key={theme}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className={`pap-theme-picker__card${selected ? ' pap-theme-picker__card--selected' : ''}`}
            onClick={() => onChange(theme)}
          >
            {selected ? <span className="pap-theme-picker__check" aria-hidden>✓</span> : null}
            <ThemeMiniPreview theme={theme} />
            <span className="pap-theme-picker__title">{meta.title}</span>
            <span className="pap-theme-picker__subtitle">{meta.subtitle}</span>
          </button>
        )
      })}
    </div>
  )
}
