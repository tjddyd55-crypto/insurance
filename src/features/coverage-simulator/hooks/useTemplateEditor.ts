import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import type { CoverageSimulatorFormMode } from '../domain/coverageSimulatorFormMode'
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
  const [formMode, setFormMode] = useState<CoverageSimulatorFormMode>(null)

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

  const editingItem = useMemo((): CoverageScenarioItem | null => {
    if (!scenario || formMode?.type !== 'edit') return null
    const found = scenario.items.find((entry) => entry.id === formMode.itemId)
    return found?.type === 'coverage' ? found : null
  }, [formMode, scenario])

  const persist = (next: CoverageScenario) => {
    if (!templateId) return
    const existing = getUserTemplateById(userKey, templateId)
    const saved = saveUserTemplate(userKey, scenarioToUserTemplate(next, existing ?? undefined))
    setScenario(templateToEditableScenario(saved))
  }

  const closeForm = useCallback(() => {
    setFormMode(null)
  }, [])

  const openAddForm = useCallback((afterOrder: number) => {
    setFormMode({ type: 'add', afterOrder })
  }, [])

  const openEditForm = useCallback((itemId: string) => {
    setFormMode({ type: 'edit', itemId })
  }, [])

  return {
    scenario,
    totals,
    sortedItems,
    persist,
    formMode,
    closeForm,
    openAddForm,
    openEditForm,
    editingItem,
    basePath,
    navigate,
    editorMode: 'template' as const,
    resetToCancerDefaults: () => {
      if (!scenario) return
      setScenario(resetScenarioItems(scenario, []))
    },
    onSelectCoverage: (input: { label: string; category: CoverageScenarioItem['category'] }) => {
      if (!scenario || formMode?.type !== 'add') return
      persist(insertCoverageItemAfter(scenario, formMode.afterOrder, input))
    },
    onSelectTimeMarker: (label: string) => {
      if (!scenario || formMode?.type !== 'add') return
      persist(insertTimeMarkerAfter(scenario, formMode.afterOrder, label))
    },
    onSaveAmount: (patch: {
      label: string
      category: CoverageScenarioItem['category']
      currentAmount: number | null
      proposedAmount: number | null
      memo?: string
    }) => {
      if (!scenario || formMode?.type !== 'edit') return
      persist(updateCoverageItem(scenario, formMode.itemId, patch))
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
