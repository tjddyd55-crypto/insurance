import type { AnalyticsChartPoint } from '../adminAnalyticsApi'

type Props = {
  points: AnalyticsChartPoint[]
  label: string
}

export function AnalyticsLineChart({ points, label }: Props) {
  if (points.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-600">
        표시할 데이터가 없습니다.
      </div>
    )
  }
  const max = Math.max(1, ...points.map((p) => p.value))
  const w = 640
  const h = 220
  const pad = 24
  const innerW = w - pad * 2
  const innerH = h - pad * 2
  const step = points.length > 1 ? innerW / (points.length - 1) : 0
  const pathD = points
    .map((p, i) => {
      const x = pad + i * step
      const y = pad + innerH - (p.value / max) * innerH
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">{label}</div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full max-w-full text-teal-600 dark:text-teal-400"
        role="img"
        aria-label={label}
      >
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => {
          const x = pad + i * step
          const y = pad + innerH - (p.value / max) * innerH
          return <circle key={p.date} cx={x} cy={y} r="3" fill="currentColor" />
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-zinc-500">
        {points.map((p) => (
          <span key={p.date} className="tabular-nums">
            {p.date}: {p.value.toLocaleString()}
          </span>
        ))}
      </div>
    </div>
  )
}
