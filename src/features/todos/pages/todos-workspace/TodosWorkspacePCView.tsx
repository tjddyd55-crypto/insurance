import { FormButton } from '../../../../components/form'


import {
  todoPriorityLabel,
  todoSourceLabel,
  todoStatusLabel,
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
    <main className="page todos-page todos-page--pc page--with-back content-wrapper page-shell bg-bg text-primary">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-primary m-0">할 일</h1>
          <p className="text-sm text-muted m-0 mt-1">플랫폼 공통 업무 할 일 목록입니다.</p>
        </div>
        <FormButton htmlType="button" variant="primary" className="filter-button" onClick={openCreateBlank}>
          + 할 일 추가
        </FormButton>
      </header>

      {error ? (
        <div className="mb-3 text-sm text-danger" role="alert">
          {error}
        </div>
      ) : null}

      <section className="mb-4 space-y-2 rounded-xl border border-border bg-card p-3">
        <div className="text-xs font-semibold text-secondary">기간·상태</div>
        <div className="flex flex-wrap gap-2">
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
        </div>
        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-border">
          <span className="text-xs font-semibold text-secondary shrink-0">연결</span>
          {(
            [
              ['any', '전체'],
              ['yes', '연결 있음'],
              ['no', '연결 없음'],
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
          <label className="ml-auto flex flex-col items-end gap-1 text-right min-w-[11rem]">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-secondary">출처</span>
            <select
              aria-label="할 일 출처 필터"
              className={`w-full rounded-lg border text-xs py-1.5 px-2 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
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
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="todos-page--pc__table min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-soft text-left text-secondary">
                <th className="todos-page--pc__th-done p-2 w-12 text-center font-semibold">완료</th>
                <th className="p-2 font-semibold">연결</th>
                <th className="p-2 font-semibold">제목</th>
                <th className="p-2 font-semibold">마감일</th>
                <th className="p-2 font-semibold">우선순위</th>
                <th className="p-2 font-semibold">상태</th>
                <th className="p-2 font-semibold">출처</th>
              </tr>
            </thead>
            <tbody>
              {todos.map((row) => (
                <tr key={row.id} className="border-t border-border hover:bg-soft">
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
                      className="text-left bg-transparent border-none p-0 cursor-pointer text-info hover:underline"
                      onClick={() => openEdit(row)}
                    >
                      {row.title}
                    </button>
                    {row.description ? (
                      <div className="text-xs text-muted line-clamp-2 mt-1 whitespace-pre-wrap">{row.description}</div>
                    ) : null}
                  </td>
                  <td className="p-2 align-middle whitespace-nowrap">
                    {formatTodoDueDateDisplay(row.dueDate)}
                    {row.dueTime ? ` ${row.dueTime}` : ''}
                  </td>
                  <td className="p-2 align-middle">{todoPriorityLabel(row.priority)}</td>
                  <td className="p-2 align-middle">{todoStatusLabel(row.status)}</td>
                  <td className="p-2 align-middle">{todoSourceLabel(row.sourceType)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
