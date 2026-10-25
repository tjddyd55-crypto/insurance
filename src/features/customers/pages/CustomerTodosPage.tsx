import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { EmptyState } from '../../../components/feedback'
import useIsMobile from '../../../hooks/useIsMobile'
import { ApiError } from '../../../lib/apiClient'
import { useAuth } from '../../auth/AuthProvider'
import { completeTodo, listTodos, reopenTodo } from '../../todos/api/todosApi'
import { TodoEditorDialog } from '../../todos/components/TodoEditorDialog'
import type { TodoDto } from '../../todos/domain/todoTypes'
import { todoDisplayContent, todoStatusLabel } from '../../todos/utils/todoCopy'
import { formatTodoDueDateDisplay } from '../../todos/utils/formatTodoDueDateDisplay'
import { orderCustomerTodos } from '../utils/customerTodosOrder'

/**
 * 고객 상세 > 할 일.
 * 일정관리 할 일(SSOT)을 기존 고객 연결(relatedEntityType='customer', relatedEntityId)로 조회만 한다.
 * 수정·삭제는 기존 TodoEditorDialog, 완료는 기존 complete/reopen API 를 그대로 쓴다.
 */
export default function CustomerTodosPage() {
  const { customerId: customerIdParam } = useParams()
  const customerId = Number(customerIdParam)
  const validCustomer = Number.isInteger(customerId) && customerId > 0
  const isMobile = useIsMobile()
  const { token, user } = useAuth()
  const gaId = user?.gaId != null && Number.isFinite(Number(user.gaId)) ? Number(user.gaId) : null
  const [todos, setTodos] = useState<TodoDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingTodo, setEditingTodo] = useState<TodoDto | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSession, setEditorSession] = useState(0)

  const load = useCallback(async () => {
    if (!token?.trim() || !validCustomer) {
      setTodos([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const rows = await listTodos(token, { customerId: String(customerId) })
      setTodos(orderCustomerTodos(rows))
    } catch (e) {
      setTodos([])
      setError(e instanceof Error ? e.message : '할 일을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [customerId, token, validCustomer])

  useEffect(() => {
    void load()
  }, [load])

  const toggleDone = async (row: TodoDto) => {
    if (!token?.trim()) return
    setError('')
    try {
      if (row.status === 'completed') await reopenTodo(token, row.id)
      else if (row.status === 'pending') await completeTodo(token, row.id)
      else return
      await load()
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : '상태 변경에 실패했습니다.')
    }
  }

  const openEdit = (row: TodoDto) => {
    setEditingTodo(row)
    setEditorSession((k) => k + 1)
    setEditorOpen(true)
  }

  const section = (
    <section className={`customer-workspace-home customer-todos-page${isMobile ? ' customer-todos-page--mobile' : ' customer-todos-page--pc'}`}>
      <h3 className="customer-workspace-home__title">할 일</h3>
      {!validCustomer ? (
        <p className="customer-workspace-home__desc">고객을 먼저 선택해 주세요.</p>
      ) : loading ? (
        <p className="customer-workspace-home__desc">불러오는 중...</p>
      ) : (
        <>
          {error ? (
            <p className="mb-3 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          {todos.length === 0 && !error ? (
            <EmptyState message="등록된 할 일이 없습니다." />
          ) : todos.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="todos-page--pc__table min-w-full text-sm border-collapse" aria-label="고객 할 일">
                <thead>
                  <tr className="bg-soft text-left text-secondary">
                    <th className="todos-page--pc__th-done p-2 w-12 text-center font-semibold">완료</th>
                    <th className="p-2 font-semibold">내용</th>
                    <th className="p-2 font-semibold">날짜</th>
                    <th className="p-2 font-semibold">시간</th>
                    <th className="p-2 font-semibold">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {todos.map((row) => (
                    <tr key={row.id} className="border-t border-border hover:bg-soft" data-todo-id={row.id} data-todo-status={row.status}>
                      <td className="todos-page--pc__td-done p-2 align-middle text-center">
                        <span className="todos-page--pc__cb-wrap inline-flex items-center justify-center">
                          {/* 일정관리 할 일 표(TodosWorkspacePCView)와 같은 체크박스 마크업 유지 */}
                          {/* eslint-disable-next-line no-restricted-syntax */}
                          <input
                            type="checkbox"
                            className="accent-brand"
                            checked={row.status === 'completed'}
                            disabled={row.status === 'canceled'}
                            onChange={() => void toggleDone(row)}
                            title={row.status === 'completed' ? '완료 취소' : '완료 처리'}
                            aria-label={row.status === 'completed' ? '완료 취소' : '완료 처리'}
                          />
                        </span>
                      </td>
                      <td className="p-2 align-middle">
                        {/* 일정관리 할 일 표와 같은 링크형 내용 버튼(FormButton 은 버튼 모양을 강제함) */}
                        {/* eslint-disable-next-line no-restricted-syntax */}
                        <button
                          type="button"
                          className="todo-item-content text-left bg-transparent border-none p-0 cursor-pointer text-info hover:underline w-full"
                          onClick={() => openEdit(row)}
                        >
                          {todoDisplayContent(row)}
                        </button>
                      </td>
                      <td className="p-2 align-middle whitespace-nowrap">{formatTodoDueDateDisplay(row.dueDate)}</td>
                      <td className="p-2 align-middle whitespace-nowrap">{row.dueTime?.trim() ? row.dueTime.slice(0, 5) : ''}</td>
                      <td className="p-2 align-middle">{todoStatusLabel(row.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </section>
  )

  return (
    <>
      {isMobile ? (
        <div className="content-wrapper page-shell customer-workspace-mobile-scope">{section}</div>
      ) : (
        section
      )}
      <TodoEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        token={token ?? ''}
        gaId={gaId}
        sessionKey={editorSession}
        editingTodo={editingTodo}
        onCommitted={() => {
          void load()
        }}
      />
    </>
  )
}
