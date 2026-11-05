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
    weekStart: '2026-11-02', weeklyTodos: [all[2], todo('4', '끝낸 주간 일', { status: 'completed', weeklyFocusWeekStart: '2026-11-02' })], weeklyLoading: false, weeklyBusyId: null, addToWeek: noop, removeFromWeek: noop,
    currentWeekStart: '2026-11-02', setWeekStart: noop, moveToWeek: noop, createWeekly: async () => undefined,
    ...over,
  }
}
const render = (p: TodosWorkspaceViewProps) => renderToStaticMarkup(<MemoryRouter><TodosWorkspacePCView {...p} /></MemoryRouter>)

describe('PC 할 일: 주간 할 일 2단', () => {
  it('왼쪽 주간 할 일(지정한 것만·라벨 없음·완료 유지·입력 줄), 오른쪽 전체 할 일 한 줄 머리 + 이번 주로', () => {
    const html = render(props())
    expect(html).toContain('todos-page__split')
    const left = html.slice(html.indexOf('weekly-todos-panel'), html.indexOf('todos-all-column'))
    expect(left).toContain('주간 할 일')
    expect(left).toContain('11.02 ~ 11.08')
    expect(left).toContain('직접 지정')
    expect(left).not.toContain('이번 주 예정 할 일') // 예정일 자동 포함 없음
    expect(left).toContain('날짜 없음')
    expect((left.match(/주간에서 빼기/g) ?? []).length).toBe(2) // 모든 항목(완료 포함)
    expect(left).not.toContain('직접 추가')
    expect(left).not.toContain('날짜 기준')
    expect(left).toContain('weekly-todos__item--done') // 완료도 남음
    expect(left.indexOf('직접 지정')).toBeLessThan(left.indexOf('끝낸 주간 일'))
    expect(left).toContain('data-testid="weekly-todos-new-input"')
    expect(left).toContain('data-testid="weekly-todos-new-add"')
    expect(left).toContain('data-testid="weekly-todo-move-next"')
    expect(left).not.toContain('data-testid="weekly-todos-this-week"')
    const right = html.slice(html.indexOf('todos-all-column'))
    expect(right).toContain('전체 할 일')
    expect((right.match(/이번 주로/g) ?? []).length).toBe(2) // 날짜만 이번 주인 것도 추가 가능
    expect(right).toContain('draggable="true"')
    expect(right).toContain('기한 지남')
    expect(right).toContain('완료')
    const head = right.slice(right.indexOf('todos-all-filters'), right.indexOf('todos-all-list'))
    expect(head).not.toContain('연결') // 연결 있음/없음 필터 제거
    expect(head).toContain('미완료')
    expect(right).toContain('할 일 출처 필터')
  })

  it('지난 주 보기: 이번 주 버튼, 빈 안내, 오른쪽은 이 주로', () => {
    const html = render(props({ weekStart: '2026-10-26', currentWeekStart: '2026-11-02', weeklyTodos: [] }))
    const left = html.slice(html.indexOf('weekly-todos-panel'), html.indexOf('todos-all-column'))
    expect(left).toContain('10.26 ~ 11.01')
    expect(left).toContain('data-testid="weekly-todos-this-week"')
    expect(left).toContain('이 주에 지정된 할 일이 없습니다.')
    expect(left).not.toContain('이번 주로 추가할 수 있습니다.')
    const right = html.slice(html.indexOf('todos-all-column'))
    expect(right).toContain('이 주로')
  })

  it('이번 주 빈 상태 안내', () => {
    const html = render(props({ currentWeekStart: '2026-11-02', weeklyTodos: [] }))
    expect(html).toContain('이 주에 지정된 할 일이 없습니다.')
    expect(html).toContain('위에 적거나 전체 할 일에서 이번 주로 추가할 수 있습니다.')
  })

  it('주간 기능 props 없으면 기존 단일 목록 그대로', () => {
    const html = render(props({ weekStart: undefined, addToWeek: undefined, removeFromWeek: undefined }))
    expect(html).not.toContain('todos-page__split')
    expect(html).not.toContain('이번 주로')
  })
})
