import type { TodoDto } from './todoTypes'

export type TodoCalendarDay = {
  date: string
  dayOfMonth: number
  inCurrentMonth: boolean
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function normalizeCalendarMonth(value: string): string {
  return /^\d{4}-\d{2}$/.test(value) ? value : formatUtcDate(new Date()).slice(0, 7)
}

export function shiftCalendarMonth(month: string, offset: number): string {
  const normalized = normalizeCalendarMonth(month)
  const [year, monthNumber] = normalized.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
  return formatUtcDate(shifted).slice(0, 7)
}

export function getCalendarMonthRange(month: string): { from: string; to: string } {
  const normalized = normalizeCalendarMonth(month)
  const [year, monthNumber] = normalized.split('-').map(Number)
  const last = new Date(Date.UTC(year, monthNumber, 0))
  return { from: `${normalized}-01`, to: formatUtcDate(last) }
}

export function buildCalendarMatrix(month: string): TodoCalendarDay[] {
  const normalized = normalizeCalendarMonth(month)
  const [year, monthNumber] = normalized.split('-').map(Number)
  const first = new Date(Date.UTC(year, monthNumber - 1, 1))
  const gridStart = new Date(first)
  gridStart.setUTCDate(1 - first.getUTCDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setUTCDate(gridStart.getUTCDate() + index)
    const dateOnly = formatUtcDate(date)
    return {
      date: dateOnly,
      dayOfMonth: date.getUTCDate(),
      inCurrentMonth: dateOnly.startsWith(normalized),
    }
  })
}

export function groupTodosByDueDate(todos: TodoDto[]): Map<string, TodoDto[]> {
  const grouped = new Map<string, TodoDto[]>()
  for (const todo of todos) {
    if (!todo.dueDate || !DATE_ONLY.test(todo.dueDate)) continue
    const bucket = grouped.get(todo.dueDate) ?? []
    bucket.push(todo)
    grouped.set(todo.dueDate, bucket)
  }
  for (const bucket of grouped.values()) {
    bucket.sort((left, right) => {
      const timeOrder = String(left.dueTime ?? '').localeCompare(String(right.dueTime ?? ''))
      return timeOrder || left.title.localeCompare(right.title, 'ko')
    })
  }
  return grouped
}
