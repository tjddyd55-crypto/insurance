import type { TodoDto } from '../../todos/domain/todoTypes'

/**
 * 고객 상세 > 할 일 표시 순서.
 * 날짜 순서는 서버 GET /api/todos 기존 정렬(due_date NULLS LAST → updated_at DESC)을 그대로 두고,
 * 미완료(pending) → 완료(completed) → 취소(canceled) 순으로만 묶는다(안정 정렬).
 */
const STATUS_RANK: Record<string, number> = { pending: 0, completed: 1, canceled: 2 }

export function orderCustomerTodos(rows: readonly TodoDto[]): TodoDto[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => (STATUS_RANK[a.row.status] ?? 3) - (STATUS_RANK[b.row.status] ?? 3) || a.index - b.index)
    .map((entry) => entry.row)
}
