import { AddItemSheet } from '../components/AddItemSheet'
import { AmountEditSheet } from '../components/AmountEditSheet'
import { CoverageBadge } from '../components/CoverageBadge'
import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import { coverageSimulatorExitPath } from '../CoverageSimulatorScope'
import { formatCoverageAmountLabel, formatTotalAmountLabel } from '../domain/formatAmount'
import type { ScenarioEditorController } from '../hooks/useScenarioEditor'
import type { CoverageScenarioItem, ScenarioItem } from '../domain/types'

type Props = { editor: ScenarioEditorController }

export function ScenarioEditorPcView({ editor }: Props) {
  const {
    scenario,
    totals,
    sortedItems,
    persist,
    openAddSheet,
    addSheetOpen,
    setAddSheetOpen,
    editingItem,
    setEditingItem,
    basePath,
    navigate,
    resetToCancerDefaults,
    onSelectCoverage,
    onSelectTimeMarker,
    onSaveAmount,
    moveItem,
    removeItem,
  } = editor

  if (!scenario) {
    return (
      <CoverageSimulatorLayout>
        <main className="coverage-simulator-content">시나리오를 준비하는 중…</main>
      </CoverageSimulatorLayout>
    )
  }

  const renderCoverageCard = (item: CoverageScenarioItem) => (
    <article key={item.id} className="coverage-simulator-pc-card">
      <div className="coverage-simulator-pc-card__head">
        <CoverageBadge category={item.category} />
        <h3 className="coverage-simulator-pc-card__title">{item.label}</h3>
      </div>
      <div className="coverage-simulator-pc-amount-row">
        <button type="button" className="coverage-simulator-amount-box" onClick={() => setEditingItem(item)}>
          <div className="coverage-simulator-amount-box__title">기존 보장</div>
          <div className="coverage-simulator-amount-box__value coverage-simulator-amount-box__value--pc">
            {formatCoverageAmountLabel(item.currentAmount)}
          </div>
        </button>
        <button
          type="button"
          className="coverage-simulator-amount-box coverage-simulator-amount-box--proposed"
          onClick={() => setEditingItem(item)}
        >
          <div className="coverage-simulator-amount-box__title">제안 보장</div>
          <div className="coverage-simulator-amount-box__value coverage-simulator-amount-box__value--pc">
            {formatCoverageAmountLabel(item.proposedAmount)}
          </div>
        </button>
      </div>
      {item.memo ? <p className="coverage-simulator-card-memo">{item.memo}</p> : null}
      <div className="coverage-simulator-card-actions coverage-simulator-card-actions--pc">
        <button type="button" onClick={() => moveItem(item.id, 'up')}>위로</button>
        <button type="button" onClick={() => moveItem(item.id, 'down')}>아래로</button>
        <button type="button" onClick={() => setEditingItem(item)}>금액 수정</button>
        <button type="button" onClick={() => removeItem(item.id)}>삭제</button>
      </div>
    </article>
  )

  const renderItem = (item: ScenarioItem) => {
    if (item.type === 'time-marker') {
      return (
        <div key={item.id} className="coverage-simulator-pc-marker">
          <span>🕐 {item.label}</span>
          <button type="button" onClick={() => removeItem(item.id)}>삭제</button>
        </div>
      )
    }
    return renderCoverageCard(item)
  }

  return (
    <CoverageSimulatorLayout>
      <header className="coverage-simulator-pc-toolbar">
        <button type="button" className="coverage-simulator-icon-btn" onClick={() => navigate(coverageSimulatorExitPath(basePath))}>
          ← 시나리오 선택
        </button>
        <h1 className="coverage-simulator-pc-toolbar__title">{scenario.title}</h1>
        <div className="coverage-simulator-pc-toolbar__actions">
          <button type="button" className="coverage-simulator-secondary-btn" onClick={resetToCancerDefaults}>초기화</button>
          <button type="button" className="coverage-simulator-secondary-btn" onClick={() => persist(scenario)}>저장</button>
          <button
            type="button"
            className="coverage-simulator-primary-btn"
            onClick={() => navigate(`${basePath}/scenarios/${scenario.id}/pdf`)}
          >
            PDF 미리보기
          </button>
        </div>
      </header>
      <main className="coverage-simulator-pc-workspace" data-testid="coverage-scenario-editor">
        <section className="coverage-simulator-pc-intro">
          <div className="coverage-simulator-intro__icon" aria-hidden="true">🎗️</div>
          <div>
            <div className="coverage-simulator-intro__title">{scenario.title}</div>
            <div className="coverage-simulator-intro__desc">{scenario.description}</div>
          </div>
        </section>
        <div className="coverage-simulator-pc-compare-labels" aria-hidden="true">
          <span>기존 보장 (현재 가입 보험)</span>
          <span className="coverage-simulator-pc-compare-labels__proposed">제안 보장 (추천 설계안)</span>
        </div>
        <div className="coverage-simulator-pc-timeline">
          {sortedItems.map((item) => (
            <div key={item.id} className="coverage-simulator-pc-timeline__block">
              {renderItem(item)}
              <button type="button" className="coverage-simulator-add-slot coverage-simulator-add-slot--pc" onClick={() => openAddSheet(item.order)}>
                + 항목 추가
              </button>
            </div>
          ))}
          {sortedItems.length === 0 ? (
            <button type="button" className="coverage-simulator-add-slot coverage-simulator-add-slot--pc" onClick={() => openAddSheet(-1)}>
              + 항목 추가
            </button>
          ) : null}
        </div>
        <aside className="coverage-simulator-pc-summary">
          <div className="coverage-simulator-summary__row">
            <span className="coverage-simulator-summary__label">기존 총 보장금액</span>
            <span className="coverage-simulator-summary__value">{formatTotalAmountLabel(totals.currentTotal)}</span>
          </div>
          <div className="coverage-simulator-summary__row coverage-simulator-summary__row--proposed">
            <span className="coverage-simulator-summary__label">제안 총 보장금액</span>
            <span className="coverage-simulator-summary__value coverage-simulator-summary__value--proposed">
              {formatTotalAmountLabel(totals.proposedTotal)}
            </span>
          </div>
        </aside>
      </main>
      <AddItemSheet open={addSheetOpen} onClose={() => setAddSheetOpen(false)} onSelectCoverage={onSelectCoverage} onSelectTimeMarker={onSelectTimeMarker} />
      <AmountEditSheet
        open={Boolean(editingItem)}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={onSaveAmount}
      />
    </CoverageSimulatorLayout>
  )
}
