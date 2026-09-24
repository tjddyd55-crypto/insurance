import { AddItemSheet } from '../components/AddItemSheet'
import { AmountEditSheet } from '../components/AmountEditSheet'
import { CoverageBadge } from '../components/CoverageBadge'
import { CenterAxisCompareEditor } from '../components/center-timeline/CenterAxisCompareEditor'
import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import { coverageSimulatorExitPath, useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { formatCoverageAmountLabel, formatTotalAmountLabel } from '../domain/formatAmount'
import type { ScenarioEditorController } from '../hooks/useScenarioEditor'
import type { CoverageScenarioItem, ScenarioItem } from '../domain/types'

type Props = { editor: ScenarioEditorController }

export function ScenarioEditorMobileView({ editor }: Props) {
  const { layoutMode } = useCoverageSimulatorScope()
  if (layoutMode === 'preview-mobile') {
    return <CenterAxisCompareEditor editor={editor} variant="mobile" />
  }

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
    <div key={item.id} className="coverage-simulator-coverage-card">
      <CoverageBadge category={item.category} />
      <div className="coverage-simulator-coverage-card__label">{item.label}</div>
      <div className="coverage-simulator-amount-grid">
        <button type="button" className="coverage-simulator-amount-box" onClick={() => setEditingItem(item)}>
          <div className="coverage-simulator-amount-box__title">기존 보장</div>
          <div className="coverage-simulator-amount-box__value">
            {formatCoverageAmountLabel(item.currentAmount)}
          </div>
        </button>
        <button
          type="button"
          className="coverage-simulator-amount-box coverage-simulator-amount-box--proposed"
          onClick={() => setEditingItem(item)}
        >
          <div className="coverage-simulator-amount-box__title">제안 보장</div>
          <div className="coverage-simulator-amount-box__value">
            {formatCoverageAmountLabel(item.proposedAmount)}
          </div>
        </button>
      </div>
      {item.memo ? <p className="coverage-simulator-card-memo">{item.memo}</p> : null}
      <div className="coverage-simulator-card-actions">
        <button type="button" onClick={() => moveItem(item.id, 'up')}>위로</button>
        <button type="button" onClick={() => moveItem(item.id, 'down')}>아래로</button>
        <button type="button" onClick={() => setEditingItem(item)}>수정</button>
        <button type="button" onClick={() => removeItem(item.id)}>삭제</button>
      </div>
    </div>
  )

  const renderItem = (item: ScenarioItem) => {
    if (item.type === 'time-marker') {
      return (
        <div key={item.id} className="coverage-simulator-timeline-row coverage-simulator-timeline-row--marker">
          <div className="coverage-simulator-timeline-dot coverage-simulator-timeline-dot--marker" aria-hidden="true" />
          <div className="coverage-simulator-time-marker">
            <span className="coverage-simulator-time-marker__label">🕐 {item.label}</span>
            <button type="button" className="coverage-simulator-time-marker__delete" onClick={() => removeItem(item.id)}>
              삭제
            </button>
          </div>
        </div>
      )
    }
    return (
      <div key={item.id} className="coverage-simulator-timeline-row">
        <div className="coverage-simulator-timeline-dot" aria-hidden="true" />
        <div>{renderCoverageCard(item)}</div>
      </div>
    )
  }

  return (
    <CoverageSimulatorLayout>
      <header className="coverage-simulator-appbar">
        <button type="button" className="coverage-simulator-icon-btn" onClick={() => navigate(coverageSimulatorExitPath(basePath))}>
          ←
        </button>
        <div className="coverage-simulator-appbar__title">{scenario.title}</div>
        <button type="button" className="coverage-simulator-text-btn" onClick={() => persist(scenario)}>저장</button>
      </header>
      <main className="coverage-simulator-content" data-testid="coverage-scenario-editor">
        <section className="coverage-simulator-intro">
          <div className="coverage-simulator-intro__icon" aria-hidden="true">🎗️</div>
          <div>
            <div className="coverage-simulator-intro__title">{scenario.title}</div>
            <div className="coverage-simulator-intro__desc">{scenario.description}</div>
          </div>
        </section>
        <div className="coverage-simulator-compare-header" aria-hidden="true">
          <span className="coverage-simulator-compare-header__spacer" />
          <div className="coverage-simulator-compare-header__cols">
            <span className="coverage-simulator-compare-header__label">
              <span className="coverage-simulator-compare-header__main">기존 보장</span>
              <span className="coverage-simulator-compare-header__sub">(현재 가입 보험)</span>
            </span>
            <span className="coverage-simulator-compare-header__label coverage-simulator-compare-header__label--proposed">
              <span className="coverage-simulator-compare-header__main">제안 보장</span>
              <span className="coverage-simulator-compare-header__sub">(추천 설계안)</span>
            </span>
          </div>
        </div>
        {sortedItems.map((item) => (
          <div key={item.id}>
            {renderItem(item)}
            <button type="button" className="coverage-simulator-add-slot" onClick={() => openAddSheet(item.order)}>
              + 항목 추가
            </button>
          </div>
        ))}
        {sortedItems.length === 0 ? (
          <button type="button" className="coverage-simulator-add-slot" onClick={() => openAddSheet(-1)}>+ 항목 추가</button>
        ) : null}
        <section className="coverage-simulator-summary">
          <div className="coverage-simulator-summary__row">
            <span className="coverage-simulator-summary__label">기존 총 보장금액 (입력 항목 합계)</span>
            <span className="coverage-simulator-summary__value">{formatTotalAmountLabel(totals.currentTotal)}</span>
          </div>
          <div className="coverage-simulator-summary__row coverage-simulator-summary__row--proposed">
            <span className="coverage-simulator-summary__label">제안 총 보장금액 (입력 항목 합계)</span>
            <span className="coverage-simulator-summary__value coverage-simulator-summary__value--proposed">
              {formatTotalAmountLabel(totals.proposedTotal)}
            </span>
          </div>
        </section>
      </main>
      <footer className="coverage-simulator-bottom-bar">
        <button type="button" className="coverage-simulator-secondary-btn" onClick={resetToCancerDefaults}>초기화</button>
        <button
          type="button"
          className="coverage-simulator-primary-btn"
          onClick={() => navigate(`${basePath}/scenarios/${scenario.id}/pdf`)}
        >
          PDF 미리보기
        </button>
      </footer>
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
