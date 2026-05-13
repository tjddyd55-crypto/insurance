import { FormButton } from '../../../../components/form'


import {
  todoPriorityLabel,
  todoSourceLabel,
  todoStatusLabel,
} from '../../utils/todoCopy'
import type { TodosWorkspaceViewProps } from './todosWorkspaceViewProps'

const FILTER_BUTTON = 'px-2 py-1 text-xs rounded-lg border border-[#334155] bg-[#111827] text-[#e5e7eb]'
const FILTER_ON = ' border-[#2563eb] bg-[#1e3a8a]'

function filterButtonClass(on: boolean): string {
  return `${FILTER_BUTTON}${on ? FILTER_ON : ''}`
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
    <main className="page todos-page todos-page--pc page--with-back content-wrapper page-shell bg-[#0b111a] text-[#e5e7eb]">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-[#f8fafc] m-0">할 일</h1>
          <p className="text-sm text-[#94a3b8] m-0 mt-1">플랫폼 공통 업무 할 일 목록입니다.</p>
        </div>
        <FormButton htmlType="button" variant="primary" className="filter-button" onClick={openCreateBlank}>
          + 할 일 추가
        </FormButton>
      </header>

      {error ? (
        <div className="mb-3 text-sm text-[#f87171]" role="alert">
          {error}
        </div>
      ) : null}

      <section className="mb-4 space-y-2 rounded-xl border border-[#1e293b] bg-[#111827] p-3">
        <div className="text-xs font-semibold text-[#cbd5e1]">기간·상태</div>
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
              className={filterButtonClass(quickFilter === k)}
              onClick={() => setQuickFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-[#1e293b]">
          <span className="text-xs font-semibold text-[#cbd5e1] shrink-0">연결</span>
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
              className={filterButtonClass(relatedFilter === k)}
              onClick={() => setRelatedFilter(k)}
            >
              {label}
            </button>
          ))}
          <label className="ml-auto text-xs text-[#94a3b8] flex items-center gap-2">
            출처
            <select
              className="rounded-lg border border-[#334155] bg-[#020617] text-[#f8fafc] text-xs py-1 px-2"
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
        <p className="text-[#94a3b8]">불러오는 중…</p>
      ) : todos.length === 0 ? (
        <p className="text-[#94a3b8]">표시할 할 일이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#1e293b]">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#1f2937] text-left text-[#cbd5e1]">
                <th className="p-2 w-10" />
                <th className="p-2">제목</th>
                <th className="p-2">연결</th>
                <th className="p-2">마감일</th>
                <th className="p-2">우선순위</th>
                <th className="p-2">상태</th>
                <th className="p-2">출처</th>
              </tr>
            </thead>
            <tbody>
              {todos.map((row) => (
                <tr key={row.id} className="border-t border-[#1e293b]">
                  <td className="p-2 align-top">
                    <input
                      type="checkbox"
                      className="accent-[#2563eb]"
                      checked={row.status === 'completed'}
                      disabled={row.status === 'canceled'}
                      onChange={() => void toggleDone(row)}
                      title={row.status === 'completed' ? '완료 취소' : '완료 처리'}
                    />
                  </td>
                  <td className="p-2 align-top">
                    <button
                      type="button"
                      className="text-left bg-transparent border-none p-0 cursor-pointer text-[#60a5fa] hover:underline"
                      onClick={() => openEdit(row)}
                    >
                      {row.title}
                    </button>
                    {row.description ? (
                      <div className="text-xs text-[#94a3b8] line-clamp-2 mt-1 whitespace-pre-wrap">{row.description}</div>
                    ) : null}
                  </td>
                  <td className="p-2 align-top text-[#e5e7eb]">
                    {row.relatedEntityType === 'customer' && row.relatedEntityId ? (
                      <button
                        type="button"
                        className="bg-transparent border-none p-0 cursor-pointer text-[#60a5fa] hover:underline"
                        onClick={() => onRelatedNavigate(row)}
                      >
                        {row.customerName?.trim() ? row.customerName : `고객 #${row.relatedEntityId}`}
                      </button>
                    ) : row.relatedEntityType || row.relatedEntityId ? (
                      <span>
                        {row.relatedEntityType ?? '—'} {row.relatedEntityId ? `#${row.relatedEntityId}` : ''}
                      </span>
                    ) : (
                      <span className="text-[#64748b]">연결 없음</span>
                    )}
                  </td>
                  <td className="p-2 align-top whitespace-nowrap">
                    {row.dueDate ?? '—'}
                    {row.dueTime ? ` ${row.dueTime}` : ''}
                  </td>
                  <td className="p-2 align-top">{todoPriorityLabel(row.priority)}</td>
                  <td className="p-2 align-top">{todoStatusLabel(row.status)}</td>
                  <td className="p-2 align-top">{todoSourceLabel(row.sourceType)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
