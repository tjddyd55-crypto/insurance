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
    <div className="pap-theme-picker" role="radiogroup" aria-label="모바일 명함 디자인">
      {ADVISOR_PROFILE_THEMES.map((theme) => {
        const selected = value === theme
        return (
          <button
            key={theme}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className={`pap-theme-picker__segment${selected ? ' pap-theme-picker__segment--selected' : ''}`}
            onClick={() => onChange(theme)}
          >
            {ADVISOR_PROFILE_THEME_LABELS[theme]}
          </button>
        )
      })}
    </div>
  )
}
