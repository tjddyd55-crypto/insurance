import { useConfirmDialog } from '../../../../components/dialog'
import { AddItemSheet } from '../AddItemSheet'
import { AmountEditSheet } from '../AmountEditSheet'
import { MobilePreviewStickyDock } from '../MobilePreviewStickyDock'
import { CoverageSimulatorLayout } from '../CoverageSimulatorLayout'
import { coverageSimulatorExitPath, useCoverageSimulatorScope } from '../../CoverageSimulatorScope'
import { CenterAxisTimeline } from './CenterAxisTimeline'
import { isTemplateEditorMode, type TimelineEditorController } from './TimelineEditorController'

type Props = {
  editor: TimelineEditorController
  variant: 'mobile' | 'pc'
}

const SCENARIO_BLURB: Record<string, string> = {
  cancer: '암 치료 과정에 따라 현재 보장과 제안 보장을 비교합니다.',
}

export function CenterAxisCompareEditor({ editor, variant }: Props) {
  const { layoutMode } = useCoverageSimulatorScope()
  const { confirm, confirmDialog } = useConfirmDialog()
  const useMobileStickyDock = variant === 'mobile' && layoutMode === 'preview-mobile'

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

  const isTemplate = isTemplateEditorMode(editor)
  const blurb = isTemplate
    ? '템플릿 항목 순서, 시점, 기본 금액을 저장합니다. 상담 시작 시 복사본으로 사용됩니다.'
    : SCENARIO_BLURB[scenario.diseaseType] ?? scenario.description

  const backTo = isTemplate ? basePath : coverageSimulatorExitPath(basePath)

  const requestReset = async () => {
    const ok = await confirm(
      isTemplate
        ? {
            title: '템플릿 항목을 비울까요?',
            message: '현재 템플릿에 저장된 항목이 모두 제거됩니다.',
            confirmLabel: '비우기',
            cancelLabel: '취소',
            tone: 'danger',
          }
        : {
            title: '작성 내용을 초기화할까요?',
            message: '현재 입력한 보장 내용이 모두 기본 상태로 돌아갑니다.',
            confirmLabel: '초기화',
            cancelLabel: '취소',
            tone: 'danger',
          },
    )
    if (ok) resetToCancerDefaults()
  }

  return (
    <CoverageSimulatorLayout>
      {variant === 'mobile' ? (
        <header className="cs-axis-header coverage-simulator-appbar">
          <button
            type="button"
            className="coverage-simulator-icon-btn"
            onClick={() => navigate(backTo)}
          >
            ←
          </button>
          <div className="cs-axis-header__titles">
            <div className="cs-axis-header__product">{isTemplate ? '템플릿 편집' : '보장 시뮬레이션'}</div>
            <div className="coverage-simulator-appbar__title">{scenario.title}</div>
          </div>
          <button type="button" className="coverage-simulator-text-btn" onClick={() => persist(scenario)}>
            저장
          </button>
        </header>
      ) : (
        <header className="cs-axis-header cs-axis-header--pc coverage-simulator-pc-toolbar">
          <button
            type="button"
            className="coverage-simulator-icon-btn"
            onClick={() => navigate(backTo)}
          >
            ← 시나리오 선택
          </button>
          <div className="cs-axis-header__titles cs-axis-header__titles--pc">
            <div className="cs-axis-header__product">{isTemplate ? '템플릿 편집' : '보장 시뮬레이션'}</div>
            <h1 className="coverage-simulator-pc-toolbar__title">{scenario.title}</h1>
          </div>
          <div className="coverage-simulator-pc-toolbar__actions">
            <button type="button" className="coverage-simulator-secondary-btn" onClick={resetToCancerDefaults}>
              초기화
            </button>
            <button type="button" className="coverage-simulator-secondary-btn" onClick={() => persist(scenario)}>
              저장
            </button>
            {!isTemplate ? (
              <button
                type="button"
                className="coverage-simulator-primary-btn"
                onClick={() => navigate(`${basePath}/scenarios/${scenario.id}/pdf`)}
              >
                PDF
              </button>
            ) : null}
          </div>
        </header>
      )}

      <main
        className={[
          variant === 'pc' ? 'cs-axis-main cs-axis-main--pc' : 'cs-axis-main coverage-simulator-content',
          useMobileStickyDock ? 'cs-axis-main--mobile-dock' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-testid="coverage-scenario-editor"
      >
        <p className="cs-axis-lead">{blurb}</p>
        <CenterAxisTimeline
          items={sortedItems}
          currentTotal={totals.currentTotal}
          proposedTotal={totals.proposedTotal}
          variant={variant}
          showInlineSummary={!useMobileStickyDock}
          onEditItem={setEditingItem}
          onMoveItem={moveItem}
          onRemoveItem={removeItem}
          onAddAfter={openAddSheet}
        />
      </main>

      {useMobileStickyDock && !isTemplate ? (
        <MobilePreviewStickyDock
          currentTotal={totals.currentTotal}
          proposedTotal={totals.proposedTotal}
          onReset={requestReset}
          onPdf={() => navigate(`${basePath}/scenarios/${scenario.id}/pdf`)}
        />
      ) : null}
      {useMobileStickyDock && isTemplate ? (
        <MobilePreviewStickyDock
          currentTotal={totals.currentTotal}
          proposedTotal={totals.proposedTotal}
          onReset={requestReset}
          resetLabel="항목 비우기"
          secondaryAction={{ label: '템플릿 저장', onClick: () => persist(scenario) }}
        />
      ) : null}
      {variant === 'mobile' && !useMobileStickyDock && !isTemplate ? (
        <footer className="coverage-simulator-bottom-bar">
          <button type="button" className="coverage-simulator-secondary-btn" onClick={requestReset}>
            초기화
          </button>
          <button
            type="button"
            className="coverage-simulator-primary-btn"
            onClick={() => navigate(`${basePath}/scenarios/${scenario.id}/pdf`)}
          >
            PDF 미리보기
          </button>
        </footer>
      ) : null}

      <AddItemSheet
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onSelectCoverage={onSelectCoverage}
        onSelectTimeMarker={onSelectTimeMarker}
      />
      <AmountEditSheet
        open={Boolean(editingItem)}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSave={onSaveAmount}
      />
      {confirmDialog}
    </CoverageSimulatorLayout>
  )
}
