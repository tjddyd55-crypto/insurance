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

export function AdvisorMobileCardThemePicker({ value, onChange, disabled }: Props) {
  return (
    <div className="pap-theme-picker pap-theme-picker--compact" role="radiogroup" aria-label="모바일 명함 디자인">
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
            className={`pap-theme-picker__card pap-theme-picker__card--compact${selected ? ' pap-theme-picker__card--selected' : ''}`}
            onClick={() => onChange(theme)}
          >
            {selected ? <span className="pap-theme-picker__check" aria-hidden>✓</span> : null}
            <span className={`pap-theme-picker__thumb pap-theme-picker__thumb--${theme}`} aria-hidden />
            <span className="pap-theme-picker__title">{meta.title}</span>
            <span className="pap-theme-picker__subtitle">{meta.subtitle}</span>
            {selected ? <span className="pap-theme-picker__selected-label">선택됨</span> : null}
          </button>
        )
      })}
    </div>
  )
}
