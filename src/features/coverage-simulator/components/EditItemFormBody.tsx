import { forwardRef, useImperativeHandle, useState } from 'react'

import FormButton from '../../../components/form/FormButton'
import FormInput from '../../../components/form/FormInput'
import {
  formatManWonInputDisplay,
  parseManWonInput,
  sanitizeManWonInputTyping,
} from '../domain/formatAmount'
import type { CoverageScenarioItem, ScenarioItemCategory } from '../domain/types'
import { CategoryChipPicker } from './CategoryChipPicker'
import { AmountInputField, FormSection } from './form-primitives'

export type EditItemFormBodyHandle = {
  save: () => void
}

type EditSavePatch = {
  label: string
  category: ScenarioItemCategory
  currentAmount: number | null
  proposedAmount: number | null
}

type Props = {
  item: CoverageScenarioItem
  onDelete: () => void
  onSave: (patch: EditSavePatch) => void
}

export const EditItemFormBody = forwardRef<EditItemFormBodyHandle, Props>(function EditItemFormBody(
  { item, onDelete, onSave },
  ref,
) {
  const [label, setLabel] = useState(item.label)
  const [category, setCategory] = useState(item.category)
  const [currentInput, setCurrentInput] = useState(() => formatManWonInputDisplay(item.currentAmount))
  const [proposedInput, setProposedInput] = useState(() => formatManWonInputDisplay(item.proposedAmount))

  const onAmountChange = (setter: (value: string) => void) => (raw: string) => {
    setter(sanitizeManWonInputTyping(raw))
  }

  useImperativeHandle(
    ref,
    () => ({
      save: () => {
        onSave({
          label: label.trim() || item.label,
          category,
          currentAmount: parseManWonInput(currentInput),
          proposedAmount: parseManWonInput(proposedInput),
        })
      },
    }),
    [category, currentInput, item.label, label, onSave, proposedInput],
  )

  return (
    <>
      <FormSection title="항목명">
        <FormInput
          id="cs-edit-label"
          value={label}
          aria-label="항목명"
          onChange={(event) => setLabel(event.target.value)}
        />
      </FormSection>
      <FormSection title="카테고리">
        <CategoryChipPicker compact value={category} onChange={setCategory} />
      </FormSection>
      <FormSection title="보장 금액">
        <div className="cs-form-primitive__amount-pair">
          <AmountInputField
            id="cs-edit-current"
            label="기존 보장"
            value={currentInput}
            onChange={onAmountChange(setCurrentInput)}
          />
          <AmountInputField
            id="cs-edit-proposed"
            label="제안 보장"
            value={proposedInput}
            proposed
            onChange={onAmountChange(setProposedInput)}
          />
        </div>
      </FormSection>
      <FormSection>
        <FormButton variant="danger" fullWidth className="cs-form-primitive__delete-btn" onClick={onDelete}>
          삭제
        </FormButton>
      </FormSection>
    </>
  )
})
