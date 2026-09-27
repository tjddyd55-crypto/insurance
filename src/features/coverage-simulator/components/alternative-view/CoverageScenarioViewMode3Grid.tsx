import type { AlternativeViewRow } from '../../domain/buildAlternativeViewRows'
import { AlternativeViewBlock } from './AlternativeViewBlock'
import type { AlternativeViewHandlers } from './alternativeViewTypes'

const HEADERS = ['카테고리', '기존 보장', '항목명', '제안 보장'] as const

type Props = AlternativeViewHandlers & {
  rows: AlternativeViewRow[]
}

export function CoverageScenarioViewMode3Grid({ rows, ...handlers }: Props) {
  return (
    <div className="cs-alt-grid" role="table" aria-label="보장 비교 표">
      <div className="cs-alt-grid__head" role="row">
        {HEADERS.map((label) => (
          <span key={label} role="columnheader">
            {label}
          </span>
        ))}
        <span className="cs-alt-grid__tools-head" aria-hidden="true" />
      </div>
      {rows.map((row) => (
        <AlternativeViewBlock key={row.key} row={row} viewMode="option3" {...handlers} />
      ))}
    </div>
  )
}
