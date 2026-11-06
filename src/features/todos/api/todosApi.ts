import { apiRequest } from '../../../lib/apiClient'
import type { TodoDto } from '../domain/todoTypes'

export type ListTodosParams = {
  status?: string
  bucket?: string
  due?: string
  dueFrom?: string
  dueTo?: string
  overdue?: string
  hasRelated?: string
  sourceType?: string
  /** 기존 고객 연결(relatedEntityType='customer' + relatedEntityId) 기준 필터 */
  customerId?: string
  /** 저장 키(그 주 월요일). 화면 일요일은 storedWeekKey 로 바꾼 뒤 넣는다. */
  weekStart?: string
  includeCompleted?: string
}

function buildTodosQuery(ps: ListTodosParams): string {
  const q = new URLSearchParams()
  if (ps.status) q.set('status', ps.status)
  if (ps.bucket) q.set('bucket', ps.bucket)
  if (ps.due) q.set('due', ps.due)
  if (ps.dueFrom) q.set('dueFrom', ps.dueFrom)
  if (ps.dueTo) q.set('dueTo', ps.dueTo)
  if (ps.overdue) q.set('overdue', ps.overdue)
  if (ps.hasRelated) q.set('hasRelated', ps.hasRelated)
  if (ps.sourceType) q.set('sourceType', ps.sourceType)
  if (ps.customerId) q.set('customerId', ps.customerId)
  if (ps.weekStart) q.set('weekStart', ps.weekStart)
  if (ps.includeCompleted) q.set('includeCompleted', ps.includeCompleted)
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function listTodos(token: string, params: ListTodosParams = {}): Promise<TodoDto[]> {
  return apiRequest<TodoDto[]>(`/api/todos${buildTodosQuery(params)}`, { token })
}

export type CreateTodoBody = {
  sourceType?: string
  sourceId?: string | null
  title: string
  description?: string
  dueDate?: string | null
  dueTime?: string | null
  priority?: string
  relatedEntityType?: string | null
  relatedEntityId?: string | null
  /** 주간 입력: 그 주 월요일. 일반 할 일 입력은 보내지 않는다 */
  weeklyFocusWeekStart?: string | null
}

export async function createTodo(token: string, body: CreateTodoBody): Promise<TodoDto> {
  return apiRequest<TodoDto>(`/api/todos`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export type PatchTodoBody = {
  title?: string
  description?: string | null
  dueDate?: string | null
  dueTime?: string | null
  priority?: string
  relatedEntityType?: string | null
  relatedEntityId?: string | null
  status?: string
  weeklyFocusWeekStart?: string | null
}

export async function patchTodo(token: string, todoId: string, body: PatchTodoBody): Promise<TodoDto> {
  return apiRequest<TodoDto>(`/api/todos/${encodeURIComponent(todoId)}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export async function completeTodo(token: string, todoId: string): Promise<TodoDto> {
  return apiRequest<TodoDto>(`/api/todos/${encodeURIComponent(todoId)}/complete`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({}),
  })
}

export async function reopenTodo(token: string, todoId: string): Promise<TodoDto> {
  return apiRequest<TodoDto>(`/api/todos/${encodeURIComponent(todoId)}/reopen`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({}),
  })
}

export async function deleteTodo(token: string, todoId: string): Promise<void> {
  await apiRequest<void>(`/api/todos/${encodeURIComponent(todoId)}`, { method: 'DELETE', token })
}
