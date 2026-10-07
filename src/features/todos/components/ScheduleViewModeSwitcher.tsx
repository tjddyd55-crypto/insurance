import type { TodosViewMode } from '../storage/todosUiStorage'
import { FormButton } from '../../../components/form'

export function ScheduleViewModeSwitcher({
  value,
  onChange,
}: {
  value: TodosViewMode
  onChange: (mode: TodosViewMode) => void
}) {
  return (
    <div className="todos-view-switcher" role="group" aria-label="일정 보기 방식">
      {([
        ['list', '목록 보기'],
        ['calendar', '달력 보기'],
      ] as const).map(([mode, label]) => (
        <FormButton
          key={mode}
          variant="action"
          className={`todos-view-switcher__button${value === mode ? ' is-active' : ''}`}
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
        >
          {label}
        </FormButton>
      ))}
    </div>
  )
}
