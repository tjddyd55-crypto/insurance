import type { AnalyticsOverall } from '../adminAnalyticsApi'

type Props = {
  statDate: string
  overall: AnalyticsOverall
}

export function UserHealthCards({ statDate, overall }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">신규 가입</div>
        <div className="mt-1 text-xl font-semibold tabular-nums">{overall.new_users.toLocaleString()}</div>
        <div className="mt-1 text-xs text-zinc-400">users.created_at · {statDate} (서울)</div>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">활동 사용자(전일)</div>
        <div className="mt-1 text-xl font-semibold tabular-nums">
          {overall.daily_active_users.toLocaleString()}
        </div>
        <div className="mt-1 text-xs text-zinc-400">analytics_events.login</div>
      </div>
    </div>
  )
}
