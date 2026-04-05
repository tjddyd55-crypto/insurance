import type { AnalyticsChartMetric, AnalyticsGaOption } from '../adminAnalyticsApi'

const METRIC_OPTIONS: { value: AnalyticsChartMetric; label: string }[] = [
  { value: 'daily_active_users', label: 'DAU' },
  { value: 'weekly_active_users', label: 'WAU' },
  { value: 'total_users', label: '총 유저' },
  { value: 'new_users', label: '신규 가입' },
  { value: 'customers_created', label: '신규 고객' },
  { value: 'documents_created', label: '문서 생성' },
  { value: 'team_messages_created', label: '상담 메시지' },
]

type Props = {
  gaOptions: AnalyticsGaOption[]
  metric: AnalyticsChartMetric
  scope: 'overall' | 'ga'
  gaId: number | ''
  statDateCap: string
  onMetricChange: (m: AnalyticsChartMetric) => void
  onScopeChange: (s: 'overall' | 'ga') => void
  onGaIdChange: (id: number | '') => void
}

export function AnalyticsFilterBar({
  gaOptions,
  metric,
  scope,
  gaId,
  statDateCap,
  onMetricChange,
  onScopeChange,
  onGaIdChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        지표
        <select
          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          value={metric}
          onChange={(e) => onMetricChange(e.target.value as AnalyticsChartMetric)}
        >
          {METRIC_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        범위
        <select
          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          value={scope}
          onChange={(e) => onScopeChange(e.target.value as 'overall' | 'ga')}
        >
          <option value="overall">전체</option>
          <option value="ga">GA별</option>
        </select>
      </label>
      {scope === 'ga' ? (
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
          GA
          <select
            className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            value={gaId === '' ? '' : String(gaId)}
            onChange={(e) => {
              const v = e.target.value
              onGaIdChange(v === '' ? '' : Number(v))
            }}
          >
            <option value="">선택…</option>
            {gaOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.code})
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p className="text-xs text-zinc-500 sm:ml-auto">
        차트 마지막 날짜는 전일까지(
        {statDateCap})로 제한됩니다.
      </p>
    </div>
  )
}
