import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { consultationContentSnapshot } from '../domain/consultationSnapshot'
import { readSessionCustomerDraft } from '../context/CoverageSimulatorCustomerContext'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { createDraftFromSystemDisease } from '../domain/startConsultation'
import {
  insertCoverageItemAfter,
  insertTimeMarkerAfter,
  moveScenarioItem,
  removeScenarioItem,
  resetScenarioItems,
  updateCoverageItem,
} from '../domain/scenarioOperations'
import { buildSystemTemplateSnapshot } from '../domain/systemTemplateCatalog'
import { createConsultationFromTemplate } from '../domain/templateOperations'
import { createCancerDefaultItems, createScenarioFromTemplate } from '../domain/templates'
import { calculateScenarioTotals } from '../domain/totals'
import type { CoverageScenario, CoverageScenarioItem, DiseaseType } from '../domain/types'
import { getScenarioById, saveScenario } from '../storage/scenarioRepository'

export type SaveConsultationResult =
  | { ok: true; toast: string }
  | { ok: false; toast: string }
  | { ok: false; needsTitle: true; validationError?: string }

export function useScenarioEditor() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const scenarioId = params.scenarioId
  const diseaseTypeParam = params.diseaseType as DiseaseType | undefined
  const { basePath, userKey } = useCoverageSimulatorScope()

  const isNewDraft = location.pathname.endsWith('/new')
  const diseaseType = (diseaseTypeParam ?? 'cancer') as DiseaseType

  const [scenario, setScenario] = useState<CoverageScenario | null>(null)
  const [addAfterOrder, setAddAfterOrder] = useState<number | null>(null)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CoverageScenarioItem | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const persistedSnapshotRef = useRef<string | null>(null)

  useEffect(() => {
    if (scenarioId) {
      const saved = getScenarioById(userKey, scenarioId)
      if (saved) {
        setScenario(saved)
        persistedSnapshotRef.current = consultationContentSnapshot(saved)
        return
      }
    }
    if (isNewDraft) {
      const customer = readSessionCustomerDraft(userKey)
      const draft = createDraftFromSystemDisease(diseaseType, customer)
      if (draft) {
        setScenario(draft)
        persistedSnapshotRef.current = null
        return
      }
    }
    const systemTemplate = buildSystemTemplateSnapshot(diseaseType)
    if (systemTemplate) {
      setScenario(
        createConsultationFromTemplate(systemTemplate, {
          diseaseType,
          description: systemTemplate.description ?? '',
          customer: readSessionCustomerDraft(userKey),
        }),
      )
      persistedSnapshotRef.current = null
      return
    }
    const created = createScenarioFromTemplate(diseaseType)
    setScenario(created)
    persistedSnapshotRef.current = null
  }, [diseaseType, isNewDraft, scenarioId, userKey])

  const totals = useMemo(
    () => (scenario ? calculateScenarioTotals(scenario) : { currentTotal: 0, proposedTotal: 0 }),
    [scenario],
  )

  const sortedItems = scenario ? scenario.items.slice().sort((a, b) => a.order - b.order) : []

  const isDirty = useCallback(() => {
    if (!scenario) return false
    if (isNewDraft || !persistedSnapshotRef.current) return true
    return consultationContentSnapshot(scenario) !== persistedSnapshotRef.current
  }, [isNewDraft, scenario])

  const commitScenario = useCallback(
    (next: CoverageScenario, options?: { writeStorage?: boolean }) => {
      if (!options?.writeStorage) {
        setScenario(next)
        return next
      }
      const saved = saveScenario(userKey, next)
      setScenario(saved)
      persistedSnapshotRef.current = consultationContentSnapshot(saved)
      if (!scenarioId) {
        navigate(`${basePath}/scenarios/${saved.id}`, { replace: true })
      }
      return saved
    },
    [basePath, navigate, scenarioId, userKey],
  )

  const persist = useCallback(
    (next: CoverageScenario) => {
      commitScenario(next, { writeStorage: true })
    },
    [commitScenario],
  )

  const applyLocal = useCallback(
    (next: CoverageScenario) => {
      commitScenario(next, { writeStorage: false })
    },
    [commitScenario],
  )

  const requestSaveConsultation = useCallback(
    async (title?: string): Promise<SaveConsultationResult> => {
      if (!scenario) {
        return { ok: false, toast: '저장하지 못했습니다. 다시 시도해 주세요.' }
      }
      const needsTitle = isNewDraft || !getScenarioById(userKey, scenario.id)
      if (needsTitle) {
        const trimmed = title?.trim() ?? ''
        if (!trimmed) {
          return { ok: false, needsTitle: true, validationError: '제목을 입력해 주세요.' }
        }
      } else if (!isDirty()) {
        return { ok: true, toast: '변경된 내용이 없습니다.' }
      }

      setIsSaving(true)
      try {
        const nextTitle = title?.trim() || scenario.title
        const saved = saveScenario(userKey, { ...scenario, title: nextTitle })
        setScenario(saved)
        persistedSnapshotRef.current = consultationContentSnapshot(saved)
        if (isNewDraft || !scenarioId) {
          navigate(`${basePath}/scenarios/${saved.id}`, { replace: true })
        }
        return { ok: true, toast: '저장되었습니다.' }
      } catch {
        return { ok: false, toast: '저장하지 못했습니다. 다시 시도해 주세요.' }
      } finally {
        setIsSaving(false)
      }
    },
    [basePath, isDirty, isNewDraft, navigate, scenario, scenarioId, userKey],
  )

  const openAddSheet = (afterOrder: number) => {
    setAddAfterOrder(afterOrder)
    setAddSheetOpen(true)
  }

  const mutate = useCallback(
    (updater: (current: CoverageScenario) => CoverageScenario) => {
      if (!scenario) return
      const next = updater(scenario)
      applyLocal(next)
    },
    [applyLocal, scenario],
  )

  return {
    scenario,
    totals,
    sortedItems,
    persist,
    isNewDraft,
    isSaving,
    isDirty,
    requestSaveConsultation,
    openAddSheet,
    addSheetOpen,
    setAddSheetOpen,
    addAfterOrder,
    editingItem,
    setEditingItem,
    basePath,
    navigate,
    diseaseType,
    resetToCancerDefaults: () => {
      if (!scenario) return
      const next = resetScenarioItems(scenario, createCancerDefaultItems())
      applyLocal(next)
    },
    onSelectCoverage: (input: { label: string; category: CoverageScenarioItem['category'] }) => {
      if (!scenario || addAfterOrder == null) return
      mutate((current) => insertCoverageItemAfter(current, addAfterOrder, input))
    },
    onSelectTimeMarker: (label: string) => {
      if (!scenario || addAfterOrder == null) return
      mutate((current) => insertTimeMarkerAfter(current, addAfterOrder, label))
    },
    onSaveAmount: (patch: {
      label: string
      category: CoverageScenarioItem['category']
      currentAmount: number | null
      proposedAmount: number | null
      memo?: string
    }) => {
      if (!scenario || !editingItem) return
      mutate((current) => updateCoverageItem(current, editingItem.id, patch))
    },
    moveItem: (id: string, direction: 'up' | 'down') => {
      if (!scenario) return
      mutate((current) => moveScenarioItem(current, id, direction))
    },
    removeItem: (id: string) => {
      if (!scenario) return
      mutate((current) => removeScenarioItem(current, id))
    },
    editorMode: 'consultation' as const,
  }
}

export type ScenarioEditorController = ReturnType<typeof useScenarioEditor>
