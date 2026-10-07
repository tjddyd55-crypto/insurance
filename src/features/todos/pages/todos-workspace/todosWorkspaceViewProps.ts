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
}
