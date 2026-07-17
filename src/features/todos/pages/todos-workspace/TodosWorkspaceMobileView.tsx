import { FormButton } from '../../../../components/form'
import {
  todoSourceLabel,
  todoStatusLabel,
  todoDisplayContent,
} from '../../utils/todoCopy'
import { formatTodoCreatedDate } from '../../utils/formatTodoCreatedDate'
import { formatTodoDueDateDisplay } from '../../utils/formatTodoDueDateDisplay'
import type { TodosWorkspaceViewProps } from './todosWorkspaceViewProps'

const CARD = 'rounded-xl border border-border bg-card p-3'

const FILTER_CHIP =
  'todo-filter-chip text-xs px-2 py-1 rounded-lg border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
const FILTER_INACTIVE = 'todo-filter-chip--inactive border-border bg-card text-primary hover:bg-soft'
const FILTER_ACTIVE =
  'todo-filter-chip--active border-brand bg-brand text-on-brand shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_40%,transparent)]'

function filterChipClass(active: boolean): string {
  return `${FILTER_CHIP} ${active ? FILTER_ACTIVE : FILTER_INACTIVE}`
}

export default function TodosWorkspaceMobileView({
  todos,
  loading,
  error,
  quickFilter,
  setQuickFilter,
  relatedFilter,
  setRelatedFilter,
  sourceFilter,
  setSourceFilter,
  openCreateBlank,
  openEdit,
  toggleDone,
  onRelatedNavigate,
}: TodosWorkspaceViewProps) {
  return (
    <main className="page todos-page todos-page--mobile page--with-back content-wrapper page-shell bg-bg text-primary pb-6">
      <header className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h1 className="text-lg font-semibold text-primary m-0">할 일</h1>
          <p className="text-xs text-muted m-0 mt-1">플랫폼 공통 업무 목록</p>
        </div>
        <FormButton htmlType="button" variant="primary" className="text-xs shrink-0" onClick={openCreateBlank}>
          + 추가
        </FormButton>
      </header>

      {error ? (
        <div className={`${CARD} mb-3 text-sm text-danger`} role="alert">
          {error}
        </div>
      ) : null}

      <section className={`${CARD} mb-3 space-y-2`}>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', '전체'],
              ['today', '오늘'],
              ['tomorrow', '내일'],
              ['week', '주'],
              ['open', '미완료'],
              ['completed', '완료'],
              ['overdue', '지남'],
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
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {(
            [
              ['any', '연결전체'],
              ['yes', '연결있음'],
              ['no', '연결없음'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={filterChipClass(relatedFilter === k)}
              onClick={() => setRelatedFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-secondary">출처</span>
          <select
            aria-label="할 일 출처 필터"
            className={`w-full rounded-lg border text-xs py-2 px-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              sourceFilter === 'all'
                ? 'border-border bg-card text-primary'
                : 'border-brand bg-brand text-on-brand shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_35%,transparent)]'
            }`}
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="all">출처: 전체</option>
            <option value="manual">직접 작성</option>
            <option value="customer_memo">고객 메모</option>
            <option value="consultation_note">상담 내역</option>
            <option value="pdf_document">PDF 문서</option>
            <option value="e_document">전자문서</option>
            <option value="system">시스템</option>
          </select>
        </label>
      </section>

      {loading ? (
        <p className="text-muted">불러오는 중…</p>
      ) : todos.length === 0 ? (
        <p className="text-muted">표시할 할 일이 없습니다.</p>
      ) : (
        <ul className="m-0 p-0 list-none space-y-2">
          {todos.map((row) => (
            <li key={row.id} className={CARD}>
              <div className="flex gap-2">
                <div
                  className="shrink-0 pt-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="accent-brand mt-0"
                    checked={row.status === 'completed'}
                    disabled={row.status === 'canceled'}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => void toggleDone(row)}
                  />
                </div>
                <div
                  className="min-w-0 flex-1 rounded-lg outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(row)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openEdit(row)
                    }
                  }}
                >
                  <div className="todo-item-content text-left w-full text-info font-semibold">
                    {todoDisplayContent(row)}
                  </div>
                  <div className="text-xs text-muted mt-1 space-y-1">
                    <div>
                      연결:{' '}
                      {row.relatedEntityType === 'customer' && row.relatedEntityId ? (
                        <button
                          type="button"
                          className="text-info underline bg-transparent border-none p-0 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRelatedNavigate(row)
                          }}
                        >
                          {row.customerName?.trim() ? row.customerName : `고객 #${row.relatedEntityId}`}
                        </button>
                      ) : row.relatedEntityType || row.relatedEntityId ? (
                        <span>
                          {row.relatedEntityType ?? '—'}{' '}
                          {row.relatedEntityId ? `#${row.relatedEntityId}` : ''}
                        </span>
                      ) : (
                        <span className="text-muted">연결 없음</span>
                      )}
                    </div>
                    <div>작성일 {formatTodoCreatedDate(row.createdAt)}</div>
                    <div>
                      마감 {formatTodoDueDateDisplay(row.dueDate, true)} · {todoStatusLabel(row.status)}
                    </div>
                    <div>출처 {todoSourceLabel(row.sourceType)}</div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
