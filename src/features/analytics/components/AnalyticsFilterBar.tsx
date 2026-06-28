import type { AnalyticsChartMetric } from '../adminAnalyticsApi'
import { ANALYTICS_METRIC_OPTIONS } from '../analyticsLabels'
import { FormSelect } from '../../../components/form'
import {
  analyticsFilterShell,
  analyticsLabel,
  analyticsMuted,
  analyticsSelect,
} from '../analyticsUiClasses'
import type { AnalyticsGaOption } from '../adminAnalyticsApi'

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
    <div className={analyticsFilterShell}>
      <label className={analyticsLabel}>
        지표
        <FormSelect
          className={analyticsSelect}
          value={metric}
          onChange={(e) => onMetricChange(e.target.value as AnalyticsChartMetric)}
          options={ANALYTICS_METRIC_OPTIONS}
        />
      </label>
      <label className={analyticsLabel}>
        범위
        <FormSelect
          className={analyticsSelect}
          value={scope}
          onChange={(e) => onScopeChange(e.target.value as 'overall' | 'ga')}
          options={[
            { value: 'overall', label: '전체' },
            { value: 'ga', label: 'GA별' },
          ]}
        />
      </label>
      {scope === 'ga' ? (
        <label className={analyticsLabel}>
          GA
          <FormSelect
            className={analyticsSelect}
            value={gaId === '' ? '' : String(gaId)}
            onChange={(e) => {
              const v = e.target.value
              onGaIdChange(v === '' ? '' : Number(v))
            }}
            options={[
              { value: '', label: '선택…' },
              ...gaOptions.map((g) => ({ value: String(g.id), label: `${g.name} (${g.code})` })),
            ]}
          />
        </label>
      ) : null}
      <p className={analyticsMuted}>차트는 전일({statDateCap})까지의 데이터를 표시합니다.</p>
    </div>
  )
}
