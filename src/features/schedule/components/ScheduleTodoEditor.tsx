import { useEffect, useState } from 'react'
import { listTodos } from '../../todos/api/todosApi'
import { TodoEditorDialog } from '../../todos/components/TodoEditorDialog'
import type { TodoDto } from '../../todos/domain/todoTypes'
import type { ScheduleTask } from '../api/scheduleApi'

/**
 * 일정 관리에서 ONE FC 할 일을 누르면 할 일 목록과 같은 상세(TodoEditorDialog)를 그 자리에서 연다.
 * 원본 TodoDto 는 서버 목록에서 id 로 찾는다(일정 응답의 notes 는 잘린 값이라 쓰지 않는다).
 */
export default function ScheduleTodoEditor({ task, token, gaId, onClose, onCommitted, onMissing }: {
  task: ScheduleTask | null
  token: string
  gaId: number | null
  onClose: () => void
  onCommitted: () => void
  onMissing: (message: string) => void
}) {
  const [todo, setTodo] = useState<TodoDto | null>(null)
  const [session, setSession] = useState(0)
  const todoId = task?.source === 'onefc_todo' ? task.sourceId : ''

  useEffect(() => {
    setTodo(null)
    if (!todoId || !token.trim()) return
    let cancelled = false
    void listTodos(token).then((rows) => {
      if (cancelled) return
      const found = rows.find((row) => row.id === todoId) ?? null
      if (found) {
        setTodo(found)
        setSession((current) => current + 1)
      } else {
        onMissing('할 일을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.')
      }
    }).catch(() => {
      if (!cancelled) onMissing('할 일을 불러오지 못했습니다.')
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열린 할 일 id 기준으로만 다시 부른다
  }, [todoId, token])

  return (
    <TodoEditorDialog
      open={Boolean(todoId && todo)}
      onClose={onClose}
      token={token}
      gaId={gaId}
      sessionKey={session}
      editingTodo={todo}
      onCommitted={onCommitted}
      showStatusToggle
    />
  )
}
