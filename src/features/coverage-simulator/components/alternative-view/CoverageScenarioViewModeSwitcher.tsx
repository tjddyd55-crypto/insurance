import FormButton from '../../../../components/form/FormButton'
import {
  COVERAGE_SCENARIO_VIEW_MODE_OPTIONS,
  type CoverageScenarioViewMode,
} from '../../domain/coverageScenarioViewMode'

type Props = {
  viewMode: CoverageScenarioViewMode
  onChange: (viewMode: CoverageScenarioViewMode) => void
  /** 헤더 액션 영역(초기화 왼쪽). content/tab bar 배치는 사용하지 않는다. */
  surface?: 'header-buttons' | 'header-select'
}

export function CoverageScenarioViewModeSwitcher({
  viewMode,
  onChange,
  surface = 'header-buttons',
}: Props) {
  if (surface === 'header-select') {
    return (
      <label className="cs-view-mode-select">
        <span className="cs-view-mode-select__label">보기</span>
        <select
          className="cs-view-mode-select__control"
          value={viewMode}
          aria-label="보기 방식"
          data-testid="coverage-view-mode-select"
          onChange={(event) => onChange(event.target.value as CoverageScenarioViewMode)}
        >
          {COVERAGE_SCENARIO_VIEW_MODE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id} data-testid={`coverage-view-mode-${option.id}`}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <div
      className="cs-view-mode-switcher cs-view-mode-switcher--header"
      role="radiogroup"
      aria-label="보기 방식"
      data-testid="coverage-view-mode-switcher"
    >
      {COVERAGE_SCENARIO_VIEW_MODE_OPTIONS.map((option) => {
        const active = option.id === viewMode
        return (
          <FormButton
            key={option.id}
            variant="action"
            role="radio"
            aria-checked={active}
            data-testid={`coverage-view-mode-${option.id}`}
            className={
              active
                ? 'cs-view-mode-switcher__chip cs-view-mode-switcher__chip--active'
                : 'cs-view-mode-switcher__chip'
            }
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </FormButton>
        )
      })}
    </div>
  )
}
