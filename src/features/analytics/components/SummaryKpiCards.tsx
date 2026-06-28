import type { AnalyticsOverall } from '../adminAnalyticsApi'
import { analyticsCard, analyticsKpiHint, analyticsKpiTitle, analyticsKpiValue } from '../analyticsUiClasses'

type Props = {
  statDate: string
  gaTotalCount: number
  overall: AnalyticsOverall
}

export function SummaryKpiCards({ gaTotalCount, overall }: Props) {
  const items = [
    { label: '등록된 GA', value: gaTotalCount, hint: '활성 GA 수' },
    { label: '전체 회원', value: overall.total_users, hint: '전일 기준 회원 수' },
    {
      label: '어제 접속한 회원',
      value: overall.daily_active_users,
      hint: '어제 접속한 회원 수입니다.',
    },
    {
      label: '최근 7일 접속한 회원',
      value: overall.weekly_active_users,
      hint: '최근 7일 동안 한 번 이상 접속한 회원 수입니다.',
    },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className={analyticsCard}>
          <div className={analyticsKpiTitle}>{it.label}</div>
          <div className={analyticsKpiValue}>{it.value.toLocaleString()}</div>
          <div className={analyticsKpiHint}>{it.hint}</div>
        </div>
      ))}
    </div>
  )
}
