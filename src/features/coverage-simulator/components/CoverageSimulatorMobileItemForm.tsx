import { useRef } from 'react'

import type { CoverageSimulatorFormMode } from '../domain/coverageSimulatorFormMode'
import { isAddFormMode, isEditFormMode } from '../domain/coverageSimulatorFormMode'
import type { CoverageScenarioItem, ScenarioItem, ScenarioItemCategory } from '../domain/types'
import { AddItemFormBody, type AddItemFormBodyHandle } from './AddItemFormBody'
import { CoverageSimulatorFormScreen } from './CoverageSimulatorFormScreen'
import { EditItemFormBody, type EditItemFormBodyHandle } from './EditItemFormBody'
import { FormActionFooter } from './form-primitives'

type Props = {
  formMode: CoverageSimulatorFormMode
  favoriteUserKey?: string | null
  editingItem: CoverageScenarioItem | null
  allItems: ScenarioItem[]
  onClose: () => void
  onSelectCoverage: (input: { label: string; category: ScenarioItemCategory }) => void
  onSelectTimeMarker: (label: string) => void
  onSaveAmount: (patch: {
    label: string
    category: ScenarioItemCategory
    currentAmount: number | null
    proposedAmount: number | null
    memo?: string
  }) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

export function CoverageSimulatorMobileItemForm({
  formMode,
  favoriteUserKey,
  editingItem,
  allItems,
  onClose,
  onSelectCoverage,
  onSelectTimeMarker,
  onSaveAmount,
  onMoveUp,
  onMoveDown,
  onDelete,
}: Props) {
  const editRef = useRef<EditItemFormBodyHandle>(null)
  const addRef = useRef<AddItemFormBodyHandle>(null)

  if (isAddFormMode(formMode)) {
    const footer = (
      <FormActionFooter
        cancelLabel="취소"
        primaryLabel="추가"
        onCancel={onClose}
        onPrimary={() => {
          addRef.current?.submitDirectAdd()
        }}
      />
    )

    return (
      <CoverageSimulatorFormScreen title="항목 추가" onClose={onClose} footer={footer}>
        <AddItemFormBody
          ref={addRef}
          key={`add-${formMode.afterOrder}`}
          favoriteUserKey={favoriteUserKey}
          onSelectCoverage={onSelectCoverage}
          onSelectTimeMarker={onSelectTimeMarker}
          onClose={onClose}
        />
      </CoverageSimulatorFormScreen>
    )
  }

  if (isEditFormMode(formMode) && editingItem) {
    const footer = (
      <FormActionFooter
        cancelLabel="취소"
        primaryLabel="저장"
        onCancel={onClose}
        onPrimary={() => {
          editRef.current?.save()
          onClose()
        }}
      />
    )

    return (
      <CoverageSimulatorFormScreen title="항목 수정" onClose={onClose} footer={footer}>
        <EditItemFormBody
          ref={editRef}
          key={editingItem.id}
          item={editingItem}
          allItems={allItems}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={onDelete}
          onSave={onSaveAmount}
        />
      </CoverageSimulatorFormScreen>
    )
  }

  return null
}
