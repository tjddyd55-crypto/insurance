/**
 * DEV REVIEW ONLY — 디자인 검수용 Hero 테마 전환 바.
 * DB `profile_theme` 을 변경하지 않는다. 확정 후 이 파일을 삭제한다.
 */
import type { AdvisorProfileTheme } from '../profileTheme'

const DEV_REVIEW_THEME_OPTIONS: ReadonlyArray<{
  theme: AdvisorProfileTheme
  planLabel: string
  englishHint: string
}> = [
  { theme: 'classic', planLabel: '1안', englishHint: 'Classic' },
  { theme: 'brand', planLabel: '2안', englishHint: 'Brand' },
  { theme: 'premium', planLabel: '3안', englishHint: 'Premium' },
]

type AdvisorThemeDevSwitcherProps = {
  value: AdvisorProfileTheme
  onChange: (theme: AdvisorProfileTheme) => void
}

export function AdvisorThemeDevSwitcher({ value, onChange }: AdvisorThemeDevSwitcherProps) {
  return (
    <div className="pap-dev-theme-review" role="group" aria-label="디자인 확인">
      <span className="pap-dev-theme-review__label">디자인 확인</span>
      <div className="pap-dev-theme-review__segments">
        {DEV_REVIEW_THEME_OPTIONS.map((option) => {
          const selected = value === option.theme
          return (
            <button
              key={option.theme}
              type="button"
              className={`pap-dev-theme-review__segment${selected ? ' pap-dev-theme-review__segment--selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onChange(option.theme)}
            >
              <span className="pap-dev-theme-review__segment-main">
                {selected ? <span className="pap-dev-theme-review__check" aria-hidden>✓</span> : null}
                {option.planLabel}
              </span>
              <span className="pap-dev-theme-review__segment-hint">{option.englishHint}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
