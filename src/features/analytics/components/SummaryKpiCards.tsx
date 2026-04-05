import type { AnalyticsOverall } from '../adminAnalyticsApi'

type Props = {
  statDate: string
  gaTotalCount: number
  overall: AnalyticsOverall
}

export function SummaryKpiCards({ statDate, gaTotalCount, overall }: Props) {
  const items = [
    { label: '총 GA', value: gaTotalCount, hint: '활성 GA 수' },
    { label: '총 유저(스냅샷)', value: overall.total_users, hint: `기준일 ${statDate}` },
    { label: '전일 접속자(DAU)', value: overall.daily_active_users, hint: '로그인 기준' },
    { label: 'WAU(7일)', value: overall.weekly_active_users, hint: '전일까지 7일·로그인' },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{it.label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {it.value.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-zinc-400">{it.hint}</div>
        </div>
      ))}
    </div>
  )
}
