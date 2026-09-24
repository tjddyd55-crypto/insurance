import { useEffect, useState } from 'react'

import {
  formatManWonInput,
  formatManWonInputDisplay,
  parseManWonInput,
  sanitizeManWonInputTyping,
} from '../domain/formatAmount'
import type { CoverageScenarioItem, ScenarioItemCategory } from '../domain/types'
import { CategoryChipPicker } from './CategoryChipPicker'

type AmountEditSheetProps = {
  open: boolean
  item: CoverageScenarioItem | null
  onClose: () => void
  mobileCompact?: boolean
  onSave: (patch: {
    label: string
    category: ScenarioItemCategory
    currentAmount: number | null
    proposedAmount: number | null
    memo?: string
  }) => void
}

export function AmountEditSheet({ open, item, onClose, mobileCompact = false, onSave }: AmountEditSheetProps) {
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<ScenarioItemCategory>('treatment')
  const [currentInput, setCurrentInput] = useState('')
  const [proposedInput, setProposedInput] = useState('')
  const [memo, setMemo] = useState('')

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

  return (
    <div className="coverage-simulator-sheet-backdrop" role="presentation">
      <div
        className={`coverage-simulator-sheet coverage-simulator-sheet--amount${mobileCompact ? ' coverage-simulator-sheet--compact' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="금액 수정"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="coverage-simulator-sheet-header coverage-simulator-sheet-header--compact">
          <div className="coverage-simulator-sheet__title">{mobileCompact ? '항목 수정' : '금액 입력'}</div>
          <button type="button" className="coverage-simulator-sheet-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
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
            <div className="coverage-simulator-amount-input-row">
              <input
                id="edit-current"
                inputMode="numeric"
                value={currentInput}
                onChange={(event) => onAmountChange(setCurrentInput)(event.target.value)}
              />
              <span>만원</span>
            </div>
          </div>
          <div className="coverage-simulator-form-field coverage-simulator-form-field--compact">
            <label htmlFor="edit-proposed">제안 보장</label>
            <div className="coverage-simulator-amount-input-row coverage-simulator-amount-input-row--proposed">
              <input
                id="edit-proposed"
                inputMode="numeric"
                value={proposedInput}
                onChange={(event) => onAmountChange(setProposedInput)(event.target.value)}
              />
              <span>만원</span>
            </div>
          </div>
        </div>
        {!mobileCompact ? (
          <div className="coverage-simulator-form-field">
            <label htmlFor="edit-memo">메모</label>
            <textarea id="edit-memo" value={memo} onChange={(event) => setMemo(event.target.value)} />
          </div>
        ) : null}
        <div className="coverage-simulator-sheet-actions coverage-simulator-sheet-actions--compact">
          <button type="button" className="coverage-simulator-secondary-btn" onClick={onClose}>취소</button>
          <button
            type="button"
            className="coverage-simulator-primary-btn"
            onClick={() => {
              onSave({
                label: label.trim() || item.label,
                category,
                currentAmount: parseManWonInput(currentInput),
                proposedAmount: parseManWonInput(proposedInput),
                memo: mobileCompact ? undefined : memo.trim() || undefined,
              })
              onClose()
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
