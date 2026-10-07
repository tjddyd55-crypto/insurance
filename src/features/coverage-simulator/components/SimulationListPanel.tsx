import type { SavedScenarioSummary } from '../domain/types'
import { formatCustomerSimulationListMetaLines } from '../domain/formatCustomerSimulationListMeta'

export type SimulationListPanelProps = {
  rows: SavedScenarioSummary[]
  emptyMessage: string
  onSelect: (id: string) => void
  /** 독립 simulator list: ⋯ 메뉴. 고객 탭은 기본 false */
  showRowMenu?: boolean
  onRowMenu?: (row: SavedScenarioSummary) => void
}

export function SimulationListPanel({
  rows,
  emptyMessage,
  onSelect,
  showRowMenu = false,
  onRowMenu,
}: SimulationListPanelProps) {
  if (rows.length === 0) {
    return <p className="coverage-simulator-page-desc customer-coverage-simulations__empty">{emptyMessage}</p>
  }

  return (
    <div className="cs-simulation-list">
      {rows.map((row) => {
        const metaLines = formatCustomerSimulationListMetaLines(row)
        return (
          <div key={row.id} className="cs-simulation-list__card">
            <button type="button" className="cs-simulation-list__card-main" onClick={() => onSelect(row.id)}>
              <div className="cs-simulation-list__title">{row.title}</div>
              {metaLines.map((line) => (
                <div key={line} className="cs-simulation-list__meta">{line}</div>
              ))}
            </button>
            {showRowMenu ? (
              <button
                type="button"
                className="cs-simulation-list__more"
                aria-label={`${row.title} 메뉴`}
                onClick={() => onRowMenu?.(row)}
              >
                ⋯
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
