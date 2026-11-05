import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import TodosWorkspacePCView from './TodosWorkspacePCView'
import type { TodoDto } from '../../domain/todoTypes'
import type { TodosWorkspaceViewProps } from './todosWorkspaceViewProps'

function todo(id: string, title: string, extra: Partial<TodoDto> = {}): TodoDto {
  return {
    id, tenantId: null, gaId: 1, ownerUserId: 'u', assigneeUserId: 'u', title, description: title,
    dueDate: null, dueTime: null, status: 'pending', priority: 'normal', sourceType: 'manual', sourceId: null,
    relatedEntityType: null, relatedEntityId: null, metadata: null, createdAt: '2026-10-01T00:00:00Z',
    updatedAt: null, completedAt: null, canceledAt: null, customerName: null, weeklyFocusWeekStart: null, ...extra,
  }
}

const noop = () => undefined
function props(over: Partial<TodosWorkspaceViewProps> = {}): TodosWorkspaceViewProps {
  const all = [todo('1', '이번 주 예정 할 일', { dueDate: '2026-11-04' }), todo('2', '다른 할 일'), todo('3', '직접 지정', { weeklyFocusWeekStart: '2026-11-02' })]
  return {
    token: 't', gaId: 1, todos: all, calendarTodos: [], loading: false, calendarLoading: false, error: '',
    quickFilter: 'open', setQuickFilter: noop, relatedFilter: 'any', setRelatedFilter: noop, sourceFilter: 'all', setSourceFilter: noop,
    viewMode: 'list', setViewMode: noop, calendarMonth: '2026-11', showPreviousMonth: noop, showNextMonth: noop, showCurrentMonth: noop,
    openCreateBlank: noop, openEdit: noop, toggleDone: noop, onRelatedNavigate: () => false,
    weekStart: '2026-11-02', weeklyTodos: [all[0], all[2]], weeklyLoading: false, weeklyBusyId: null, addToWeek: noop, removeFromWeek: noop,
    ...over,
  }
}
const render = (p: TodosWorkspaceViewProps) => renderToStaticMarkup(<MemoryRouter><TodosWorkspacePCView {...p} /></MemoryRouter>)

describe('PC 할 일: 주간 할 일 2단', () => {
  it('왼쪽 주간 할 일(설명·범위·수동/자동·주간에서 빼기), 오른쪽 전체 할 일 + 이번 주로', () => {
    const html = render(props())
    expect(html).toContain('todos-page__split')
    const left = html.slice(html.indexOf('weekly-todos-panel'), html.indexOf('todos-all-column'))
    expect(left).toContain('주간 할 일')
    expect(left).toContain('이번 주에 집중할 할 일을 모아봅니다.')
    expect(left).toContain('11.02 ~ 11.08')
    expect(left).toContain('이번 주 예정 할 일')
    expect(left).toContain('날짜 없음')
    expect((left.match(/주간에서 빼기/g) ?? []).length).toBe(1) // 수동만
    expect(left).toContain('weekly-todos__item--manual')
    const right = html.slice(html.indexOf('todos-all-column'))
    expect(right).toContain('전체 할 일')
    expect((right.match(/이번 주로/g) ?? []).length).toBe(1) // '다른 할 일' 만
    expect(right).toContain('draggable="true"')
    expect(right).toContain('기한 지남')
  })

  it('주간 기능 props 없으면 기존 단일 목록 그대로', () => {
    const html = render(props({ weekStart: undefined, addToWeek: undefined, removeFromWeek: undefined }))
    expect(html).not.toContain('todos-page__split')
    expect(html).not.toContain('이번 주로')
  })
})
