import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import {
  insertCoverageItemAfter,
  insertTimeMarkerAfter,
  moveScenarioItem,
  removeScenarioItem,
  resetScenarioItems,
  updateCoverageItem,
} from '../domain/scenarioOperations'
import { scenarioToUserTemplate, templateToEditableScenario } from '../domain/templateOperations'
import { calculateScenarioTotals } from '../domain/totals'
import type { CoverageScenario, CoverageScenarioItem } from '../domain/types'
import { getUserTemplateById, saveUserTemplate } from '../storage/templateRepository'

export function useTemplateEditor() {
  const navigate = useNavigate()
  const { templateId } = useParams()
  const { basePath, userKey } = useCoverageSimulatorScope()

  const [scenario, setScenario] = useState<CoverageScenario | null>(null)
  const [addAfterOrder, setAddAfterOrder] = useState<number | null>(null)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CoverageScenarioItem | null>(null)

  useEffect(() => {
    if (!templateId) return
    const template = getUserTemplateById(userKey, templateId)
    if (template) {
      setScenario(templateToEditableScenario(template))
    }
  }, [templateId, userKey])

  const totals = useMemo(
    () => (scenario ? calculateScenarioTotals(scenario) : { currentTotal: 0, proposedTotal: 0 }),
    [scenario],
  )

  const sortedItems = scenario ? scenario.items.slice().sort((a, b) => a.order - b.order) : []

  const persist = (next: CoverageScenario) => {
    if (!templateId) return
    const existing = getUserTemplateById(userKey, templateId)
    const saved = saveUserTemplate(userKey, scenarioToUserTemplate(next, existing ?? undefined))
    setScenario(templateToEditableScenario(saved))
  }

  const openAddSheet = (afterOrder: number) => {
    setAddAfterOrder(afterOrder)
    setAddSheetOpen(true)
  }

  return {
    scenario,
    totals,
    sortedItems,
    persist,
    openAddSheet,
    addSheetOpen,
    setAddSheetOpen,
    addAfterOrder,
    editingItem,
    setEditingItem,
    basePath,
    navigate,
    editorMode: 'template' as const,
    resetToCancerDefaults: () => {
      if (!scenario) return
      setScenario(resetScenarioItems(scenario, []))
    },
    onSelectCoverage: (input: { label: string; category: CoverageScenarioItem['category'] }) => {
      if (!scenario || addAfterOrder == null) return
      persist(insertCoverageItemAfter(scenario, addAfterOrder, input))
    },
    onSelectTimeMarker: (label: string) => {
      if (!scenario || addAfterOrder == null) return
      persist(insertTimeMarkerAfter(scenario, addAfterOrder, label))
    },
    onSaveAmount: (patch: {
      label: string
      category: CoverageScenarioItem['category']
      currentAmount: number | null
      proposedAmount: number | null
      memo?: string
    }) => {
      if (!scenario || !editingItem) return
      persist(updateCoverageItem(scenario, editingItem.id, patch))
    },
    patchCoverageItem: (
      itemId: string,
      patch: Partial<
        Pick<CoverageScenarioItem, 'label' | 'category' | 'currentAmount' | 'proposedAmount' | 'memo'>
      >,
    ) => {
      if (!scenario) return
      persist(updateCoverageItem(scenario, itemId, patch))
    },
    moveItem: (id: string, direction: 'up' | 'down') => {
      if (!scenario) return
      persist(moveScenarioItem(scenario, id, direction))
    },
    removeItem: (id: string) => {
      if (!scenario) return
      persist(removeScenarioItem(scenario, id))
    },
  }
}

export type TemplateEditorController = ReturnType<typeof useTemplateEditor>
