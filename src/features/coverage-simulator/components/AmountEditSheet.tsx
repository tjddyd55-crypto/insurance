import { useState } from 'react'

import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import FormSelect from '../../../components/form/FormSelect'
import FormTextarea from '../../../components/form/FormTextarea'
import { useCoverageSimulatorOverlayScrollLock } from '../hooks/useCoverageSimulatorOverlayScrollLock'
import { formatManWonInput, parseManWonInput } from '../domain/formatAmount'
import type { CoverageScenarioItem, ScenarioItem, ScenarioItemCategory } from '../domain/types'

type AmountEditSheetProps = {
  open: boolean
  item: CoverageScenarioItem | null
  allItems?: ScenarioItem[]
  onClose: () => void
  onSave: (patch: {
    label: string
    category: ScenarioItemCategory
    currentAmount: number | null
    proposedAmount: number | null
    memo?: string
  }) => void
}

function AmountEditSheetForm({
  item,
  onClose,
  onSave,
}: {
  item: CoverageScenarioItem
  onClose: () => void
  onSave: AmountEditSheetProps['onSave']
}) {
  const [label, setLabel] = useState(item.label)
  const [category, setCategory] = useState(item.category)
  const [currentInput, setCurrentInput] = useState(() => formatManWonInput(item.currentAmount))
  const [proposedInput, setProposedInput] = useState(() => formatManWonInput(item.proposedAmount))
  const [memo, setMemo] = useState(item.memo ?? '')

  const save = () => {
    onSave({
      label: label.trim() || item.label,
      category,
      currentAmount: parseManWonInput(currentInput),
      proposedAmount: parseManWonInput(proposedInput),
      memo: memo.trim() || undefined,
    })
    onClose()
  }

  return (
    <>
      <div className="coverage-simulator-sheet-header coverage-simulator-sheet-header--compact">
        <div className="coverage-simulator-sheet__title">금액 입력</div>
        <FormButton variant="action" className="coverage-simulator-sheet-close" onClick={onClose} aria-label="닫기">
          ×
        </FormButton>
      </div>
      <div className="coverage-simulator-form-field coverage-simulator-form-field--compact">
        <label htmlFor="edit-label-desktop">항목명</label>
        <FormInput id="edit-label-desktop" value={label} onChange={(event) => setLabel(event.target.value)} />
      </div>
      <div className="coverage-simulator-form-field coverage-simulator-form-field--compact">
        <span className="coverage-simulator-form-field__label">카테고리</span>
        <FormSelect
          id="edit-category"
          value={category}
          onChange={(event) => setCategory(event.target.value as ScenarioItemCategory)}
          options={[
            { value: 'diagnosis', label: '진단' },
            { value: 'treatment', label: '치료' },
            { value: 'recovery', label: '회복' },
            { value: 'support', label: '지원' },
            { value: 'other', label: '기타' },
          ]}
        />
      </div>
      <div className="coverage-simulator-amount-pair">
        <div className="coverage-simulator-form-field coverage-simulator-form-field--compact">
          <label htmlFor="edit-current-d">기존 보장</label>
          <div className="coverage-simulator-amount-input-row">
            <FormInput
              id="edit-current-d"
              inputMode="numeric"
              value={currentInput}
              onChange={(event) => setCurrentInput(event.target.value.replace(/[^\d]/g, ''))}
            />
            <span>만원</span>
          </div>
        </div>
        <div className="coverage-simulator-form-field coverage-simulator-form-field--compact">
          <label htmlFor="edit-proposed-d">제안 보장</label>
          <div className="coverage-simulator-amount-input-row coverage-simulator-amount-input-row--proposed">
            <FormInput
              id="edit-proposed-d"
              inputMode="numeric"
              value={proposedInput}
              onChange={(event) => setProposedInput(event.target.value.replace(/[^\d]/g, ''))}
            />
            <span>만원</span>
          </div>
        </div>
      </div>
      <div className="coverage-simulator-form-field">
        <label htmlFor="edit-memo">메모</label>
        <FormTextarea id="edit-memo" value={memo} onChange={(event) => setMemo(event.target.value)} />
      </div>
      <div className="coverage-simulator-sheet-actions">
        <FormButton variant="secondary" onClick={onClose}>취소</FormButton>
        <FormButton variant="primary" onClick={save}>확인</FormButton>
      </div>
    </>
  )
}

/** Desktop modal sheet — mobile uses `CoverageSimulatorMobileItemForm`. */
export function AmountEditSheet({ open, item, onClose, onSave }: AmountEditSheetProps) {
  useCoverageSimulatorOverlayScrollLock(open)

  if (!open || !item) return null

  return (
    <div className="coverage-simulator-sheet-backdrop" role="presentation">
      <div
        className="coverage-simulator-sheet coverage-simulator-sheet--amount"
        role="dialog"
        aria-modal="true"
        aria-label="금액 수정"
        onClick={(event) => event.stopPropagation()}
      >
        <AmountEditSheetForm key={item.id} item={item} onClose={onClose} onSave={onSave} />
      </div>
    </div>
  )
}
