import type { AnalyticsChartMetric } from './adminAnalyticsApi'

const ANALYTICS_METRIC_LABEL: Record<AnalyticsChartMetric, string> = {
  total_users: '전체 회원',
  daily_active_users: '어제 접속한 회원',
  weekly_active_users: '최근 7일 접속한 회원',
  new_users: '신규 가입',
  customers_created: '새 고객 등록',
  documents_created: '신청서 생성',
  team_messages_created: '팀 상담 메시지',
}

export function getAnalyticsMetricLabel(metric: AnalyticsChartMetric): string {
  return ANALYTICS_METRIC_LABEL[metric] ?? metric
}

export const ANALYTICS_METRIC_OPTIONS: { value: AnalyticsChartMetric; label: string }[] = (
  Object.entries(ANALYTICS_METRIC_LABEL) as [AnalyticsChartMetric, string][]
).map(([value, label]) => ({ value, label }))

/** DAU/WAU 등 개발자 용어가 UI에 노출되지 않는지 검증용 */
export const ANALYTICS_FORBIDDEN_UI_TERMS = ['DAU', 'WAU', 'analytics_events', 'snapshot'] as const
