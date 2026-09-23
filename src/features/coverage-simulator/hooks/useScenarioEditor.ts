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
import { createCancerDefaultItems, createScenarioFromTemplate } from '../domain/templates'
import { calculateScenarioTotals } from '../domain/totals'
import type { CoverageScenario, CoverageScenarioItem, DiseaseType } from '../domain/types'
import { getScenarioById, saveScenario } from '../storage/scenarioRepository'

export function useScenarioEditor() {
  const navigate = useNavigate()
  const params = useParams()
  const scenarioId = params.scenarioId
  const diseaseType = params.diseaseType ?? 'cancer'
  const { basePath, userKey } = useCoverageSimulatorScope()

  const [scenario, setScenario] = useState<CoverageScenario | null>(null)
  const [addAfterOrder, setAddAfterOrder] = useState<number | null>(null)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CoverageScenarioItem | null>(null)

  useEffect(() => {
    if (scenarioId) {
      const saved = getScenarioById(userKey, scenarioId)
      if (saved) {
        setScenario(saved)
        return
      }
    }
    const created = createScenarioFromTemplate(diseaseType as DiseaseType)
    setScenario(created)
  }, [diseaseType, scenarioId, userKey])

  const totals = useMemo(
    () => (scenario ? calculateScenarioTotals(scenario) : { currentTotal: 0, proposedTotal: 0 }),
    [scenario],
  )

  const sortedItems = scenario ? scenario.items.slice().sort((a, b) => a.order - b.order) : []

  const persist = (next: CoverageScenario) => {
    const saved = saveScenario(userKey, next)
    setScenario(saved)
    if (!scenarioId) {
      navigate(`${basePath}/scenarios/${saved.id}`, { replace: true })
    }
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
    resetToCancerDefaults: () => {
      if (!scenario) return
      setScenario(resetScenarioItems(scenario, createCancerDefaultItems()))
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

export type ScenarioEditorController = ReturnType<typeof useScenarioEditor>
