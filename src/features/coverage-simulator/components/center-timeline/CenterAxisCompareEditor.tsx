import { useCallback, useEffect, useMemo, useState } from 'react'

import { useConfirmDialog } from '../../../../components/dialog'
import FormButton from '../../../../components/form/FormButton'
import { AddItemSheet } from '../AddItemSheet'
import { AmountEditSheet } from '../AmountEditSheet'
import { CoverageSimulatorMobileItemForm } from '../CoverageSimulatorMobileItemForm'
import { CoverageSimulatorLayout } from '../CoverageSimulatorLayout'
import { CoverageSimulatorToastProvider, useCoverageSimulatorToast } from '../CoverageSimulatorToast'
import { CoverageShareDialog } from '../CoverageShareDialog'
import { MobilePreviewEditorHeader } from '../MobilePreviewEditorHeader'
import { useCoverageShareFlow } from '../../hooks/useCoverageShareFlow'
import { MobilePreviewStickyDock } from '../MobilePreviewStickyDock'
import { SaveConsultationTitleDialog } from '../SaveConsultationTitleDialog'
import { diseaseTypeTitle } from '../../domain/diseaseTypeLabels'
import { useCoverageSimulatorScope } from '../../CoverageSimulatorScope'
import { buildCoverageTimelineViewModel } from '../../domain/buildCoverageTimelineViewModel'
import { CoverageScenarioTimeline, type InlineAmountEditTarget } from './CoverageScenarioTimeline'
import type { InlineAmountField } from './InlineAmountQuickEdit'
import { isTemplateEditorMode, type TimelineEditorController } from './TimelineEditorController'

type Props = {
  editor: TimelineEditorController
  variant: 'mobile' | 'pc'
}

const SCENARIO_BLURB: Record<string, string> = {
  cancer: '암 치료 과정에 따라 현재 보장과 제안 보장을 비교합니다.',
}

function CenterAxisCompareEditorBody({ editor, variant }: Props) {
  const { layoutMode, userKey } = useCoverageSimulatorScope()
  const { confirm, confirmDialog } = useConfirmDialog()
  const { showToast } = useCoverageSimulatorToast()
  const useMobileStickyDock = variant === 'mobile' && layoutMode === 'preview-mobile'
  const useMobileExclusiveForm = variant === 'mobile'
  const [titleDialogOpen, setTitleDialogOpen] = useState(false)
  const [titleValidationError, setTitleValidationError] = useState<string | null>(null)
  const [inlineAmountEdit, setInlineAmountEdit] = useState<InlineAmountEditTarget>(null)

  const {
    scenario,
    totals,
    sortedItems,
    persist,
    requestSaveConsultation,
    isSaving,
    isDirty,
    formMode,
    closeForm,
    openAddForm,
    openEditForm,
    editingItem,
    basePath,
    navigate,
    resetToCancerDefaults,
    onSelectCoverage,
    onSelectTimeMarker,
    onSaveAmount,
    patchCoverageItem,
    moveItem,
    removeItem,
  } = editor

  const handleInlineAmountEditChange = useCallback(
    (target: InlineAmountEditTarget) => {
      if (target) {
        closeForm()
      }
      setInlineAmountEdit(target)
    },
    [closeForm],
  )

  const handleInlineAmountCommit = useCallback(
    (itemId: string, field: InlineAmountField, amount: number | null) => {
      const patch = field === 'current' ? { currentAmount: amount } : { proposedAmount: amount }
      patchCoverageItem(itemId, patch)
    },
    [patchCoverageItem],
  )

  const openAddSheetForOrder = useCallback(
    (afterOrder: number) => {
      setInlineAmountEdit(null)
      openAddForm(afterOrder)
    },
    [openAddForm],
  )

  const openFullAmountEdit = useCallback(
    (item: { id: string }) => {
      setInlineAmountEdit(null)
      openEditForm(item.id)
    },
    [openEditForm],
  )

  const handleEditSheetDelete = useCallback(async () => {
    if (formMode?.type !== 'edit') return
    const ok = await confirm({
      title: '이 항목을 삭제할까요?',
      message: '삭제 후 되돌릴 수 없습니다.',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (!ok) return
    removeItem(formMode.itemId)
    closeForm()
  }, [closeForm, confirm, formMode, removeItem])

  useEffect(() => {
    if (!scenario || formMode?.type !== 'edit') return
    const exists = scenario.items.some((entry) => entry.id === formMode.itemId && entry.type === 'coverage')
    if (!exists) closeForm()
  }, [closeForm, formMode, scenario])

  const isTemplateEarly = isTemplateEditorMode(editor)
  const shareFlow = useCoverageShareFlow({
    scenario: isTemplateEarly ? null : scenario,
    isTemplate: isTemplateEarly,
    isDirty,
    requestSaveConsultation,
    showToast,
    confirm,
  })

  const viewModel = useMemo(() => {
    if (!scenario) return null
    return buildCoverageTimelineViewModel(scenario, { compactInsert: useMobileStickyDock })
  }, [scenario, useMobileStickyDock])

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

  const backTo = isTemplate ? basePath : `${basePath}/${scenario.diseaseType}`

  const handleSave = async () => {
    const result = await requestSaveConsultation()
    if ('needsTitle' in result && result.needsTitle) {
      setTitleValidationError(result.validationError ?? null)
      setTitleDialogOpen(true)
      return
    }
    showToast(result.ok ? result.toast : result.toast)
  }

  const handleTitleConfirm = async (title: string) => {
    const result = await requestSaveConsultation(title)
    if ('needsTitle' in result && result.needsTitle) {
      setTitleValidationError(result.validationError ?? '제목을 입력해 주세요.')
      return
    }
    setTitleDialogOpen(false)
    setTitleValidationError(null)
    showToast(result.ok ? result.toast : result.toast)
  }

  const editorHeaderTitle = isTemplate ? scenario.title : diseaseTypeTitle(scenario.diseaseType)

  const requestRemoveCoverageItem = async (id: string) => {
    const ok = await confirm({
      title: '이 항목을 삭제할까요?',
      message: '삭제 후 되돌릴 수 없습니다.',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (ok) removeItem(id)
  }

  const requestRemoveTimeMarker = async (id: string) => {
    const ok = await confirm({
      title: '이 시간 구간을 삭제할까요?',
      message: '삭제 후 되돌릴 수 없습니다.',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (ok) removeItem(id)
  }

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

  if (useMobileExclusiveForm && formMode) {
    return (
      <CoverageSimulatorLayout shellClassName="coverage-simulator-shell--exclusive-form">
        <CoverageSimulatorMobileItemForm
          formMode={formMode}
          favoriteUserKey={useMobileStickyDock ? userKey : null}
          editingItem={editingItem}
          onClose={closeForm}
          onSelectCoverage={onSelectCoverage}
          onSelectTimeMarker={onSelectTimeMarker}
          onSaveAmount={onSaveAmount}
          onDelete={handleEditSheetDelete}
        />
        {confirmDialog}
        {!isTemplate ? (
          <SaveConsultationTitleDialog
            open={titleDialogOpen}
            initialTitle={scenario.title}
            validationError={titleValidationError}
            saving={isSaving}
            onClose={() => {
              setTitleDialogOpen(false)
              setTitleValidationError(null)
            }}
            onConfirm={handleTitleConfirm}
          />
        ) : null}
      </CoverageSimulatorLayout>
    )
  }

  return (
    <CoverageSimulatorLayout>
      {variant === 'mobile' && useMobileStickyDock ? (
        <MobilePreviewEditorHeader
          title={editorHeaderTitle}
          onBack={() => navigate(backTo)}
          onReset={requestReset}
          onSave={isTemplate ? () => persist(scenario) : handleSave}
          saving={!isTemplate && isSaving}
          onPdf={!isTemplate ? () => navigate(`${basePath}/scenarios/${scenario.id}/pdf`) : undefined}
          onShare={shareFlow.showShareButton ? () => void shareFlow.openShareDialog() : undefined}
          shareDisabled={shareFlow.sharing}
          showShare={shareFlow.showShareButton}
          showPdf={!isTemplate}
          resetLabel={isTemplate ? '비우기' : '초기화'}
        />
      ) : variant === 'mobile' ? (
        <header className="cs-axis-header coverage-simulator-appbar">
          <FormButton variant="action" className="coverage-simulator-icon-btn" onClick={() => navigate(backTo)}>
            ←
          </FormButton>
          <div className="cs-axis-header__titles">
            <div className="coverage-simulator-appbar__title">{scenario.title}</div>
          </div>
          <FormButton
            variant="action"
            className="coverage-simulator-text-btn"
            onClick={isTemplate ? () => persist(scenario) : handleSave}
          >
            {isSaving ? '저장 중…' : '저장'}
          </FormButton>
        </header>
      ) : (
        <header className="cs-axis-header cs-axis-header--pc coverage-simulator-pc-toolbar">
          <FormButton variant="action" className="coverage-simulator-icon-btn" onClick={() => navigate(backTo)}>
            ← 시나리오 선택
          </FormButton>
          <div className="cs-axis-header__titles cs-axis-header__titles--pc">
            <div className="cs-axis-header__product">{isTemplate ? '템플릿 편집' : '보장 시뮬레이션'}</div>
            <h1 className="coverage-simulator-pc-toolbar__title">{scenario.title}</h1>
          </div>
          <div className="coverage-simulator-pc-toolbar__actions">
            <FormButton variant="secondary" className="coverage-simulator-secondary-btn" onClick={resetToCancerDefaults}>
              초기화
            </FormButton>
            <FormButton
              variant="secondary"
              className="coverage-simulator-secondary-btn"
              onClick={isTemplate ? () => persist(scenario) : handleSave}
            >
              {isSaving ? '저장 중…' : '저장'}
            </FormButton>
            {!isTemplate && shareFlow.showShareButton ? (
              <FormButton
                variant="secondary"
                className="coverage-simulator-secondary-btn"
                disabled={shareFlow.sharing}
                onClick={() => void shareFlow.openShareDialog()}
              >
                {shareFlow.sharing ? '공유 중…' : '공유'}
              </FormButton>
            ) : null}
            {!isTemplate ? (
              <FormButton
                variant="primary"
                className="coverage-simulator-primary-btn"
                onClick={() => navigate(`${basePath}/scenarios/${scenario.id}/pdf`)}
              >
                PDF
              </FormButton>
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
        {!useMobileStickyDock ? <p className="cs-axis-lead">{blurb}</p> : null}
        {viewModel ? (
        <CoverageScenarioTimeline
          mode="editable"
          viewModel={viewModel}
          variant={variant}
          showGrandTotal={!useMobileStickyDock}
          compactInsert={useMobileStickyDock}
          itemMenuMode={useMobileStickyDock ? 'action-sheet' : 'popover'}
          onEditItem={openFullAmountEdit}
          onMoveItem={moveItem}
          onRemoveItem={requestRemoveCoverageItem}
          onRemoveTimeMarker={requestRemoveTimeMarker}
          onAddAfter={openAddSheetForOrder}
          enableInlineAmountEdit={useMobileStickyDock}
          inlineAmountEdit={inlineAmountEdit}
          onInlineAmountEditChange={handleInlineAmountEditChange}
          onInlineAmountCommit={handleInlineAmountCommit}
        />
        ) : null}
      </main>

      {useMobileStickyDock ? (
        <MobilePreviewStickyDock currentTotal={totals.currentTotal} proposedTotal={totals.proposedTotal} />
      ) : null}
      {variant === 'mobile' && !useMobileStickyDock && !isTemplate ? (
        <footer className="coverage-simulator-bottom-bar">
          <FormButton variant="secondary" className="coverage-simulator-secondary-btn" onClick={requestReset}>
            초기화
          </FormButton>
          <FormButton
            variant="primary"
            className="coverage-simulator-primary-btn"
            onClick={() => navigate(`${basePath}/scenarios/${scenario.id}/pdf`)}
          >
            PDF 미리보기
          </FormButton>
        </footer>
      ) : null}

      {variant === 'pc' || !useMobileExclusiveForm ? (
        <>
          <AddItemSheet
            open={formMode?.type === 'add'}
            onClose={closeForm}
            onSelectCoverage={onSelectCoverage}
            onSelectTimeMarker={onSelectTimeMarker}
            favoriteUserKey={useMobileStickyDock ? userKey : null}
          />
          <AmountEditSheet
            open={formMode?.type === 'edit'}
            item={editingItem}
            allItems={sortedItems}
            onClose={closeForm}
            onSave={onSaveAmount}
          />
        </>
      ) : null}
      {confirmDialog}
      {!isTemplate ? (
        <SaveConsultationTitleDialog
          open={titleDialogOpen}
          initialTitle={scenario.title}
          validationError={titleValidationError}
          saving={isSaving}
          onClose={() => {
            setTitleDialogOpen(false)
            setTitleValidationError(null)
          }}
          onConfirm={handleTitleConfirm}
        />
      ) : null}
      {!isTemplate ? (
        <CoverageShareDialog
          open={shareFlow.dialogOpen}
          phase={shareFlow.phase}
          loading={shareFlow.sharing}
          createError={shareFlow.createError}
          shareUrl={shareFlow.shareUrl}
          historyShares={shareFlow.shareHistory}
          historyLoading={shareFlow.shareHistoryLoading}
          historyError={shareFlow.shareHistoryError}
          onClose={shareFlow.closeDialog}
          onCreateShare={() => void shareFlow.createShare()}
          onCopyLink={() => void shareFlow.copyShareLink()}
          onNativeShare={() => void shareFlow.nativeShare()}
          onRetryHistory={shareFlow.reloadShareHistory}
          onCopyHistoryLink={(url) => void shareFlow.copyHistoryLink(url)}
          onRevokeShare={(shareId) => void shareFlow.revokeShare(shareId)}
          canNativeShare={shareFlow.canNativeShare}
        />
      ) : null}
    </CoverageSimulatorLayout>
  )
}

export function CenterAxisCompareEditor(props: Props) {
  return (
    <CoverageSimulatorToastProvider>
      <CenterAxisCompareEditorBody {...props} />
    </CoverageSimulatorToastProvider>
  )
}
