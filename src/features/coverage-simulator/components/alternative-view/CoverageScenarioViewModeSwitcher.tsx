import FormButton from '../../../../components/form/FormButton'
import {
  COVERAGE_SCENARIO_VIEW_MODE_OPTIONS,
  type CoverageScenarioViewMode,
} from '../../domain/coverageScenarioViewMode'

type Props = {
  viewMode: CoverageScenarioViewMode
  onChange: (viewMode: CoverageScenarioViewMode) => void
}

export function CoverageScenarioViewModeSwitcher({ viewMode, onChange }: Props) {
  return (
    <div
      className="cs-view-mode-switcher"
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
            className={active ? 'cs-view-mode-switcher__chip cs-view-mode-switcher__chip--active' : 'cs-view-mode-switcher__chip'}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </FormButton>
        )
      })}
    </div>
  )
}
