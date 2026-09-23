import { useEffect, useState } from 'react'

import { formatManWonInput, parseManWonInput } from '../domain/formatAmount'
import type { CoverageScenarioItem, ScenarioItemCategory } from '../domain/types'

type AmountEditSheetProps = {
  open: boolean
  item: CoverageScenarioItem | null
  onClose: () => void
  onSave: (patch: {
    label: string
    category: ScenarioItemCategory
    currentAmount: number | null
    proposedAmount: number | null
    memo?: string
  }) => void
}

export function AmountEditSheet({ open, item, onClose, onSave }: AmountEditSheetProps) {
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<ScenarioItemCategory>('treatment')
  const [currentInput, setCurrentInput] = useState('')
  const [proposedInput, setProposedInput] = useState('')
  const [memo, setMemo] = useState('')

  useEffect(() => {
    if (!item) return
    setLabel(item.label)
    setCategory(item.category)
    setCurrentInput(formatManWonInput(item.currentAmount))
    setProposedInput(formatManWonInput(item.proposedAmount))
    setMemo(item.memo ?? '')
  }, [item])

  if (!open || !item) return null

  return (
    <div className="coverage-simulator-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="coverage-simulator-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="금액 수정"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="coverage-simulator-sheet__title">보장 금액 수정</div>
        <div className="coverage-simulator-form-field">
          <label htmlFor="edit-label">항목명</label>
          <input id="edit-label" value={label} onChange={(event) => setLabel(event.target.value)} />
        </div>
        <div className="coverage-simulator-form-field">
          <label htmlFor="edit-category">카테고리</label>
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
        </div>
        <div className="coverage-simulator-form-field">
          <label htmlFor="edit-current">기존 보장</label>
          <div className="coverage-simulator-amount-input-row">
            <input
              id="edit-current"
              inputMode="numeric"
              value={currentInput}
              onChange={(event) => setCurrentInput(event.target.value.replace(/[^\d]/g, ''))}
            />
            <span>만원</span>
          </div>
        </div>
        <div className="coverage-simulator-form-field">
          <label htmlFor="edit-proposed">제안 보장</label>
          <div className="coverage-simulator-amount-input-row">
            <input
              id="edit-proposed"
              inputMode="numeric"
              value={proposedInput}
              onChange={(event) => setProposedInput(event.target.value.replace(/[^\d]/g, ''))}
            />
            <span>만원</span>
          </div>
        </div>
        <div className="coverage-simulator-form-field">
          <label htmlFor="edit-memo">메모</label>
          <textarea id="edit-memo" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </div>
        <div className="coverage-simulator-bottom-bar" style={{ position: 'static', padding: 0, border: 0 }}>
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
                memo: memo.trim() || undefined,
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
