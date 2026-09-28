import ResponsiveLayout from '../../../components/ResponsiveLayout'
import { TodoEditorDialog } from '../components/TodoEditorDialog'
import { useTodosWorkspaceState } from '../hooks/useTodosWorkspaceState'
import TodosWorkspaceMobileView from './todos-workspace/TodosWorkspaceMobileView'
import TodosWorkspacePCView from './todos-workspace/TodosWorkspacePCView'
import type { TodosWorkspaceViewProps } from './todos-workspace/todosWorkspaceViewProps'
import '../styles/todos-calendar.css'

export default function TodosWorkspacePage() {
  const vm = useTodosWorkspaceState()

  const viewProps: TodosWorkspaceViewProps = {
    token: vm.token,
    gaId: vm.gaId,
    todos: vm.todos,
    calendarTodos: vm.calendarTodos,
    loading: vm.loading,
    calendarLoading: vm.calendarLoading,
    error: vm.error,
    quickFilter: vm.quickFilter,
    setQuickFilter: vm.setQuickFilter,
    relatedFilter: vm.relatedFilter,
    setRelatedFilter: vm.setRelatedFilter,
    sourceFilter: vm.sourceFilter,
    setSourceFilter: vm.setSourceFilter,
    viewMode: vm.viewMode,
    setViewMode: vm.setViewMode,
    calendarMonth: vm.calendarMonth,
    showPreviousMonth: vm.showPreviousMonth,
    showNextMonth: vm.showNextMonth,
    showCurrentMonth: vm.showCurrentMonth,
    openCreateBlank: vm.openCreateBlank,
    openEdit: vm.openEdit,
    toggleDone: vm.toggleDone,
    onRelatedNavigate: vm.onRelatedNavigate,
  }

  return (
    <>
      <ResponsiveLayout<TodosWorkspaceViewProps>
        PC={TodosWorkspacePCView}
        Mobile={TodosWorkspaceMobileView}
        viewProps={viewProps}
      />
      <TodoEditorDialog
        open={vm.editorOpen}
        onClose={() => vm.setEditorOpen(false)}
        token={vm.token}
        gaId={vm.gaId}
        sessionKey={vm.editorSession}
        editingTodo={vm.editingTodo}
        prefill={vm.editorPrefill}
        onCommitted={() => {
          void vm.reload()
          if (vm.viewMode === 'calendar') void vm.reloadCalendar()
        }}
      />
    </>
  )
}
