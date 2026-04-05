import type { AnalyticsOverall } from '../adminAnalyticsApi'

type Props = {
  statDate: string
  overall: AnalyticsOverall
}

export function ActivitySummaryCards({ statDate, overall }: Props) {
  const items = [
    { label: '신규 고객', value: overall.customers_created },
    { label: '문서(신청서) 생성', value: overall.documents_created },
    { label: '팀 상담 메시지', value: overall.team_messages_created },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{it.label}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {it.value.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-zinc-400">전일 {statDate}</div>
        </div>
      ))}
    </div>
  )
}
