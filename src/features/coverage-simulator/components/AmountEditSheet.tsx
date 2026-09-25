import { useEffect, useMemo, useState } from 'react'

import { useCoverageSimulatorOverlayScrollLock } from '../hooks/useCoverageSimulatorOverlayScrollLock'
import { coverageItemMoveState } from '../domain/timelinePeriodBounds'

import {
  formatManWonInput,
  formatManWonInputDisplay,
  parseManWonInput,
  sanitizeManWonInputTyping,
} from '../domain/formatAmount'
import type { CoverageScenarioItem, ScenarioItem, ScenarioItemCategory } from '../domain/types'
import { CategoryChipPicker } from './CategoryChipPicker'
import { CoverageSimulatorFormSheet } from './CoverageSimulatorFormSheet'

type AmountEditSheetProps = {
  open: boolean
  item: CoverageScenarioItem | null
  allItems?: ScenarioItem[]
  onClose: () => void
  mobileCompact?: boolean
  onSave: (patch: {
    label: string
    category: ScenarioItemCategory
    currentAmount: number | null
    proposedAmount: number | null
    memo?: string
  }) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDelete?: () => void
}

export function AmountEditSheet({
  open,
  item,
  allItems = [],
  onClose,
  mobileCompact = false,
  onSave,
  onMoveUp,
  onMoveDown,
  onDelete,
}: AmountEditSheetProps) {
  useCoverageSimulatorOverlayScrollLock(open && !mobileCompact)
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<ScenarioItemCategory>('treatment')
  const [currentInput, setCurrentInput] = useState('')
  const [proposedInput, setProposedInput] = useState('')
  const [memo, setMemo] = useState('')

  const moveState = useMemo(
    () => (item ? coverageItemMoveState(allItems, item.id) : { canMoveUp: false, canMoveDown: false }),
    [allItems, item],
  )

  useEffect(() => {
    if (!item) return
    setLabel(item.label)
    setCategory(item.category)
    if (mobileCompact) {
      setCurrentInput(formatManWonInputDisplay(item.currentAmount))
      setProposedInput(formatManWonInputDisplay(item.proposedAmount))
    } else {
      setCurrentInput(formatManWonInput(item.currentAmount))
      setProposedInput(formatManWonInput(item.proposedAmount))
    }
    setMemo(item.memo ?? '')
  }, [item, mobileCompact])

  if (!open || !item) return null

  const onAmountChange = (setter: (value: string) => void) => (raw: string) => {
    setter(mobileCompact ? sanitizeManWonInputTyping(raw) : raw.replace(/[^\d]/g, ''))
  }

  const title = mobileCompact ? '항목 수정' : '금액 입력'

  const save = () => {
    onSave({
      label: label.trim() || item.label,
      category,
      currentAmount: parseManWonInput(currentInput),
      proposedAmount: parseManWonInput(proposedInput),
      memo: mobileCompact ? undefined : memo.trim() || undefined,
    })
    onClose()
  }

  const formFields = (
    <>
      <div className="coverage-simulator-form-field coverage-simulator-form-field--compact">
        <label htmlFor="edit-label">항목명</label>
        <input id="edit-label" value={label} onChange={(event) => setLabel(event.target.value)} />
      </div>
      <div className="coverage-simulator-form-field coverage-simulator-form-field--compact">
        <span className="coverage-simulator-form-field__label">카테고리</span>
        {mobileCompact ? (
          <CategoryChipPicker value={category} onChange={setCategory} />
        ) : (
          <select
            id="edit-category"
            value={category}
            onChange={(event) => setCategory(event.target.value as ScenarioItemCategory)}
          >
            <option value="diagnosis">진단</option>
            <option value="treatment">치료</option>
            <option value="recovery">회복</option>
            <option value="support">지원</option>
            <option value="other">기타</option>
          </select>
        )}
      </div>
      <div
        className={`coverage-simulator-amount-pair${mobileCompact ? ' coverage-simulator-amount-pair--compact' : ''}`}
      >
        <div className="coverage-simulator-form-field coverage-simulator-form-field--compact">
          <label htmlFor="edit-current">기존 보장</label>
          <div className="coverage-simulator-amount-input-row cs-form-sheet__amount-field">
            <input
              id="edit-current"
              inputMode="numeric"
              value={currentInput}
              onChange={(event) => onAmountChange(setCurrentInput)(event.target.value)}
            />
            <span className="cs-form-sheet__unit">만원</span>
          </div>
        </div>
        <div className="coverage-simulator-form-field coverage-simulator-form-field--compact">
          <label htmlFor="edit-proposed">제안 보장</label>
          <div className="coverage-simulator-amount-input-row coverage-simulator-amount-input-row--proposed cs-form-sheet__amount-field">
            <input
              id="edit-proposed"
              inputMode="numeric"
              value={proposedInput}
              onChange={(event) => onAmountChange(setProposedInput)(event.target.value)}
            />
            <span className="cs-form-sheet__unit">만원</span>
          </div>
        </div>
      </div>
      {mobileCompact && onMoveUp && onMoveDown ? (
        <div className="cs-form-sheet__move-row">
          <button type="button" className="cs-form-sheet__move-btn" disabled={!moveState.canMoveUp} onClick={onMoveUp}>
            ↑ 위로 이동
          </button>
          <button
            type="button"
            className="cs-form-sheet__move-btn"
            disabled={!moveState.canMoveDown}
            onClick={onMoveDown}
          >
            ↓ 아래로 이동
          </button>
        </div>
      ) : null}
      {mobileCompact && onDelete ? (
        <button type="button" className="cs-form-sheet__delete-btn" onClick={onDelete}>
          삭제
        </button>
      ) : null}
      {!mobileCompact ? (
        <div className="coverage-simulator-form-field">
          <label htmlFor="edit-memo">메모</label>
          <textarea id="edit-memo" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </div>
      ) : null}
    </>
  )

  const footer = (
    <div className="coverage-simulator-sheet-actions coverage-simulator-sheet-actions--compact cs-form-sheet__footer-actions">
      <button type="button" className="coverage-simulator-secondary-btn" onClick={onClose}>취소</button>
      <button type="button" className="coverage-simulator-primary-btn" onClick={save}>
        {mobileCompact ? '저장' : '확인'}
      </button>
    </div>
  )

  if (mobileCompact) {
    return (
      <CoverageSimulatorFormSheet open={open} title={title} onClose={onClose} footer={footer}>
        {formFields}
      </CoverageSimulatorFormSheet>
    )
  }

  return (
    <div className="coverage-simulator-sheet-backdrop" role="presentation">
      <div
        className="coverage-simulator-sheet coverage-simulator-sheet--amount"
        role="dialog"
        aria-modal="true"
        aria-label="금액 수정"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="coverage-simulator-sheet-header coverage-simulator-sheet-header--compact">
          <div className="coverage-simulator-sheet__title">{title}</div>
          <button type="button" className="coverage-simulator-sheet-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        {formFields}
        {footer}
      </div>
    </div>
  )
}
