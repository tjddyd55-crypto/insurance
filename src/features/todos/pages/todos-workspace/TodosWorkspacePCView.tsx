import { useState, type DragEvent } from 'react'
import { FormButton } from '../../../../components/form'
import { WeeklyTodosPanel } from '../../components/WeeklyTodosPanel'
import { belongsToWeek, formatWeekRangeLabel, WEEKLY_BACK_DRAG_MIME, WEEKLY_DRAG_MIME } from '../../domain/weeklyFocus'
import { ScheduleCalendarView } from '../../components/ScheduleCalendarView'
import { ScheduleViewModeSwitcher } from '../../components/ScheduleViewModeSwitcher'
import {
  todoSourceLabel,
  todoStatusLabel,
  todoDisplayContent,
} from '../../utils/todoCopy'
import { formatTodoDueDateDisplay } from '../../utils/formatTodoDueDateDisplay'
import type { TodosWorkspaceViewProps } from './todosWorkspaceViewProps'

const FILTER_CHIP =
  'todo-filter-chip px-2 py-1 text-xs rounded-lg border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
const FILTER_CHIP_INACTIVE =
  'todo-filter-chip--inactive border-border bg-card text-primary hover:bg-soft'
const FILTER_CHIP_ACTIVE =
  'todo-filter-chip--active border-brand bg-brand text-on-brand shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_40%,transparent)]'

function filterChipClass(active: boolean): string {
  return `${FILTER_CHIP} ${active ? FILTER_CHIP_ACTIVE : FILTER_CHIP_INACTIVE}`
}

function sourceTypeOptions() {
  return [
    { v: 'all', l: '출처: 전체' },
    { v: 'manual', l: '직접 작성' },
    { v: 'customer_memo', l: '고객 메모' },
    { v: 'consultation_note', l: '상담 내역' },
    { v: 'pdf_document', l: 'PDF 문서' },
    { v: 'e_document', l: '전자문서' },
    { v: 'system', l: '시스템' },
  ]
}

export default function TodosWorkspacePCView({
  todos,
  calendarTodos,
  loading,
  calendarLoading,
  error,
  quickFilter,
  setQuickFilter,
  sourceFilter,
  setSourceFilter,
  viewMode,
  setViewMode,
  calendarMonth,
  showPreviousMonth,
  showNextMonth,
  showCurrentMonth,
  openCreateBlank,
  openEdit,
  toggleDone,
  onRelatedNavigate,
  weekStart,
  currentWeekStart,
  setWeekStart,
  moveToWeek,
  createWeekly,
  weeklyTodos = [],
  weeklyLoading = false,
  weeklyBusyId = null,
  addToWeek,
  removeFromWeek,
}: TodosWorkspaceViewProps) {
  const weeklyEnabled = Boolean(weekStart && addToWeek && removeFromWeek)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [backDropOver, setBackDropOver] = useState(false)
  const viewingCurrentWeek = !currentWeekStart || weekStart === currentWeekStart
  const weeklyIds = new Set(weeklyTodos.map((t) => t.id))
  const findTodo = (id: string) => todos.find((t) => t.id === id) ?? weeklyTodos.find((t) => t.id === id)
  const onMainDragOver = (event: DragEvent) => {
    if (!weeklyEnabled || !event.dataTransfer.types.includes(WEEKLY_BACK_DRAG_MIME)) return
    event.preventDefault()
    if (!backDropOver) setBackDropOver(true)
  }
  const onMainDrop = (event: DragEvent) => {
    const id = event.dataTransfer.getData(WEEKLY_BACK_DRAG_MIME)
    setBackDropOver(false)
    if (!id) return
    event.preventDefault()
    const row = findTodo(id)
    if (row) removeFromWeek?.(row)
  }
  const renderListBody = (withTitle: boolean) => (
    <>
      {/* 전체 할 일 머리: 한 줄(왼쪽 제목, 오른쪽 기간·상태 필터 + 출처). '연결 있음/없음' 필터는 없음 */}
      <section className="todos-page__all-head rounded-xl border border-border bg-card" data-testid="todos-all-filters">
        {withTitle ? <h2 className="todos-page__all-title">전체 할 일</h2> : null}
        <div className="todos-page__all-filters" data-testid="todos-status-filters">
          {(
            [
              ['all', '전체'],
              ['today', '오늘'],
              ['tomorrow', '내일'],
              ['week', '이번 주'],
              ['open', '미완료'],
              ['completed', '완료'],
              ['overdue', '기한 지남'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={filterChipClass(quickFilter === k)}
              onClick={() => setQuickFilter(k)}
            >
              {label}
            </button>
          ))}
          <label className="todos-page__source-filter flex items-center">
            <select
              aria-label="할 일 출처 필터"
              className={`rounded-lg border text-xs py-1 px-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                sourceFilter === 'all'
                  ? 'border-border bg-card text-primary'
                  : 'border-brand bg-brand text-on-brand shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_35%,transparent)]'
              }`}
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              {sourceTypeOptions().map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      {loading ? (
        <p className="text-muted">불러오는 중…</p>
      ) : todos.length === 0 ? (
        <p className="text-muted">표시할 할 일이 없습니다.</p>
      ) : (
        <div className="todos-page__all-list overflow-x-auto rounded-xl border border-border" data-testid="todos-all-list">
          <table className="todos-page--pc__table min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-soft text-left text-secondary">
                <th className="todos-page--pc__th-done p-2 w-12 text-center font-semibold">완료</th>
                <th className="p-2 font-semibold">연결</th>
                <th className="p-2 font-semibold">내용</th>
                <th className="p-2 font-semibold">날짜</th>
                <th className="p-2 font-semibold">상태</th>
                <th className="p-2 font-semibold">출처</th>
                {weeklyEnabled ? <th className="p-2 font-semibold">주간</th> : null}
              </tr>
            </thead>
            <tbody>
              {todos.map((row) => (
                <tr
                  key={row.id}
                  className={`border-t border-border hover:bg-soft${draggingId === row.id ? ' todos-page__row--dragging' : ''}`}
                  draggable={weeklyEnabled && row.status === 'pending'}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(WEEKLY_DRAG_MIME, row.id)
                    event.dataTransfer.effectAllowed = 'move'
                    setDraggingId(row.id)
                  }}
                  onDragEnd={() => setDraggingId(null)}
                >
                  <td className="todos-page--pc__td-done p-2 align-middle text-center">
                    <span className="todos-page--pc__cb-wrap inline-flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="accent-brand"
                        checked={row.status === 'completed'}
                        disabled={row.status === 'canceled'}
                        onChange={() => void toggleDone(row)}
                        title={row.status === 'completed' ? '완료 취소' : '완료 처리'}
                      />
                    </span>
                  </td>
                  <td className="p-2 align-middle text-primary">
                    {row.relatedEntityType === 'customer' && row.relatedEntityId ? (
                      <button
                        type="button"
                        className="bg-transparent border-none p-0 cursor-pointer text-info hover:underline"
                        onClick={() => onRelatedNavigate(row)}
                      >
                        {row.customerName?.trim() ? row.customerName : `고객 #${row.relatedEntityId}`}
                      </button>
                    ) : row.relatedEntityType || row.relatedEntityId ? (
                      <span>
                        {row.relatedEntityType ?? '—'} {row.relatedEntityId ? `#${row.relatedEntityId}` : ''}
                      </span>
                    ) : (
                      <span className="text-muted">연결 없음</span>
                    )}
                  </td>
                  <td className="p-2 align-middle">
                    <button
                      type="button"
                      className="todo-item-content text-left bg-transparent border-none p-0 cursor-pointer text-info hover:underline w-full"
                      onClick={() => openEdit(row)}
                    >
                      {todoDisplayContent(row)}
                    </button>
                  </td>
                  <td className="p-2 align-middle whitespace-nowrap">
                    {formatTodoDueDateDisplay(row.dueDate)}
                  </td>
                  <td className="p-2 align-middle">{todoStatusLabel(row.status)}</td>
                  <td className="p-2 align-middle">{todoSourceLabel(row.sourceType)}</td>
                  {weeklyEnabled ? (
                    <td className="p-2 align-middle">
                      {row.status !== 'pending' ? null : weeklyIds.has(row.id) || belongsToWeek(row, weekStart!) ? (
                        <span className="text-xs text-muted whitespace-nowrap">{viewingCurrentWeek ? '이번 주' : '이 주'}</span>
                      ) : (
                        // eslint-disable-next-line no-restricted-syntax -- 표 행 안의 작은 보조 동작(기존 표 버튼과 동일)
                        <button
                          type="button"
                          className="todos-page__to-week"
                          disabled={weeklyBusyId === row.id}
                          title={`${formatWeekRangeLabel(weekStart!)} 주간 할 일에 추가`}
                          onClick={() => addToWeek?.(row)}
                        >
                          {viewingCurrentWeek ? '이번 주로' : '이 주로'}
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
  return (
    <main className="page todos-page todos-page--pc page--with-back content-wrapper page-shell bg-bg text-primary">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-primary m-0">할 일</h1>
          <p className="text-sm text-muted m-0 mt-1">플랫폼 공통 업무 할 일 목록입니다.</p>
        </div>
        <div className="todos-page__header-actions">
          <ScheduleViewModeSwitcher value={viewMode} onChange={setViewMode} />
          <FormButton htmlType="button" variant="primary" className="filter-button" onClick={() => openCreateBlank()}>
            + 할 일 추가
          </FormButton>
        </div>
      </header>

      {error ? (
        <div className="mb-3 text-sm text-danger" role="alert">
          {error}
        </div>
      ) : null}

      {viewMode === 'calendar' ? (
        <ScheduleCalendarView
          month={calendarMonth}
          todos={calendarTodos}
          loading={calendarLoading}
          compact={false}
          onPreviousMonth={showPreviousMonth}
          onNextMonth={showNextMonth}
          onToday={showCurrentMonth}
          onEdit={openEdit}
          onCreate={openCreateBlank}
        />
      ) : weeklyEnabled ? (
        <div className="todos-page__split">
          <WeeklyTodosPanel
            weekStart={weekStart!}
            currentWeekStart={currentWeekStart ?? weekStart!}
            onChangeWeek={setWeekStart}
            onMoveWeek={moveToWeek}
            todos={weeklyTodos}
            loading={weeklyLoading}
            busyId={weeklyBusyId}
            onToggleDone={toggleDone}
            onOpen={openEdit}
            onDropTodoId={(id) => {
              const row = findTodo(id)
              if (row) addToWeek?.(row)
            }}
            onRemove={removeFromWeek}
            onCreate={createWeekly}
            scheduleWeekHref={`/schedule/week?date=${weekStart}`}
          />
          <div
            className={`todos-page__split-main${backDropOver ? ' todos-page__split-main--drop' : ''}`}
            onDragOver={onMainDragOver}
            onDragLeave={() => setBackDropOver(false)}
            onDrop={onMainDrop}
            data-testid="todos-all-column"
          >
            {renderListBody(true)}
          </div>
        </div>
      ) : (
        renderListBody(false)
      )}
    </main>
  )
}
