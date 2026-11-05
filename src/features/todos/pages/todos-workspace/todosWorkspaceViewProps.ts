import type { TodoDto } from '../domain/todoTypes'
import type { TodoRelatedFilter, TodoQuickFilter } from '../hooks/useTodosWorkspaceState'
import type { TodosViewMode } from '../storage/todosUiStorage'

export type TodosWorkspaceViewProps = {
  token: string
  gaId: number | null
  todos: TodoDto[]
  calendarTodos: TodoDto[]
  loading: boolean
  calendarLoading: boolean
  error: string
  quickFilter: TodoQuickFilter
  setQuickFilter: (v: TodoQuickFilter) => void
  relatedFilter: TodoRelatedFilter
  setRelatedFilter: (v: TodoRelatedFilter) => void
  sourceFilter: string
  setSourceFilter: (v: string) => void
  viewMode: TodosViewMode
  setViewMode: (mode: TodosViewMode) => void
  calendarMonth: string
  showPreviousMonth: () => void
  showNextMonth: () => void
  showCurrentMonth: () => void
  openCreateBlank: (dueDate?: string) => void
  openEdit: (row: TodoDto) => void
  toggleDone: (row: TodoDto) => void
  onRelatedNavigate: (row: TodoDto) => boolean
  /** 왼쪽 주간 할 일이 보고 있는 주(월요일) */
  weekStart?: string
  /** 오늘이 속한 주(월요일) */
  currentWeekStart?: string
  /** 왼쪽 주간 할 일 주 이동 */
  setWeekStart?: (weekStart: string) => void
  /** 직접 지정 주 변경(이전/다음 주). due_date 는 그대로 */
  moveToWeek?: (row: TodoDto, weekStart: string) => void
  /** 주간 입력: 날짜 없이 보고 있는 주로 새 할 일 */
  createWeekly?: (title: string) => Promise<unknown>
  weeklyTodos?: TodoDto[]
  weeklyLoading?: boolean
  weeklyBusyId?: string | null
  addToWeek?: (row: TodoDto) => void
  removeFromWeek?: (row: TodoDto) => void
}
