import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { consultationContentSnapshot } from '../domain/consultationSnapshot'
import { readSessionCustomerDraft } from '../context/CoverageSimulatorCustomerContext'
import { emptyCustomerDraft, type ConsultationCustomerDraft } from '../domain/customerContext'
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
import type { CoverageSimulatorFormMode } from '../domain/coverageSimulatorFormMode'
import type { CoverageScenario, CoverageScenarioItem, DiseaseType } from '../domain/types'
import { saveConsultationAsync } from '../storage/consultationRepository'
import { getScenarioById, saveScenario } from '../storage/scenarioRepository'
import { useCoverageSimulatorCrmStorage } from '../context/CoverageSimulatorCrmStorageContext'
import { isPreviewUserKey } from '../storage/previewStorageKeys'

export type SaveConsultationResult =
  | { ok: true; toast?: string }
  | { ok: false; toast: string }
  | { ok: false; needsTitle: true; validationError?: string }

export type UseScenarioEditorOptions = {
  scenarioIdOverride?: string | null
  embedded?: boolean
  onSaved?: (scenario: CoverageScenario) => void
}

export function useScenarioEditor(options?: UseScenarioEditorOptions) {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const scenarioId = options?.scenarioIdOverride ?? params.scenarioId
  const embedded = options?.embedded ?? false
  const onSaved = options?.onSaved
  const diseaseTypeParam = params.diseaseType as DiseaseType | undefined
  const { basePath, userKey } = useCoverageSimulatorScope()
  const { version: storageVersion } = useCoverageSimulatorCrmStorage()

  const isNewDraft = location.pathname.endsWith('/new')
  const diseaseType = (diseaseTypeParam ?? 'cancer') as DiseaseType

  const [scenario, setScenario] = useState<CoverageScenario | null>(null)
  const [formMode, setFormMode] = useState<CoverageSimulatorFormMode>(null)
  const [isSaving, setIsSaving] = useState(false)
  const persistedSnapshotRef = useRef<string | null>(null)

  useEffect(() => {
    if (embedded && !scenarioId) {
      setScenario(null)
      persistedSnapshotRef.current = null
      return
    }
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
  }, [diseaseType, embedded, isNewDraft, scenarioId, storageVersion, userKey])

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
      if (isPreviewUserKey(userKey)) {
        const saved = saveScenario(userKey, next)
        setScenario(saved)
        persistedSnapshotRef.current = consultationContentSnapshot(saved)
        if (!embedded && !scenarioId) {
          navigate(`${basePath}/scenarios/${saved.id}`, { replace: true })
        }
        return saved
      }
      throw new Error('CRM에서는 persist 대신 저장을 사용하세요.')
    },
    [basePath, embedded, navigate, scenarioId, userKey],
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
        return { ok: true }
      }

      setIsSaving(true)
      try {
        const nextTitle = title?.trim() || scenario.title
        const saved = await saveConsultationAsync(userKey, { ...scenario, title: nextTitle })
        setScenario(saved)
        persistedSnapshotRef.current = consultationContentSnapshot(saved)
        if (!embedded && (isNewDraft || !scenarioId)) {
          navigate(`${basePath}/scenarios/${saved.id}`, { replace: true })
        }
        onSaved?.(saved)
        return { ok: true }
      } catch {
        return { ok: false, toast: '저장하지 못했습니다. 다시 시도해 주세요.' }
      } finally {
        setIsSaving(false)
      }
    },
    [basePath, embedded, isDirty, isNewDraft, navigate, onSaved, scenario, scenarioId, userKey],
  )

  const closeForm = useCallback(() => {
    setFormMode(null)
  }, [])

  const openAddForm = useCallback((afterOrder: number) => {
    setFormMode({ type: 'add', afterOrder })
  }, [])

  const openEditForm = useCallback((itemId: string) => {
    setFormMode({ type: 'edit', itemId })
  }, [])

  const mutate = useCallback(
    (updater: (current: CoverageScenario) => CoverageScenario) => {
      setScenario((current) => {
        if (!current) return current
        const next = updater(current)
        return next
      })
    },
    [],
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
    formMode,
    closeForm,
    openAddForm,
    openEditForm,
    editingItem,
    basePath,
    navigate,
    diseaseType,
    resetToCancerDefaults: () => {
      if (!scenario) return
      const next = resetScenarioItems(scenario, createCancerDefaultItems())
      applyLocal(next)
    },
    onSelectCoverage: (input: { label: string; category: CoverageScenarioItem['category'] }) => {
      if (formMode?.type !== 'add') return
      mutate((current) => insertCoverageItemAfter(current, formMode.afterOrder, input))
    },
    onSelectTimeMarker: (label: string) => {
      if (formMode?.type !== 'add') return
      mutate((current) => insertTimeMarkerAfter(current, formMode.afterOrder, label))
    },
    onSaveAmount: (patch: {
      label: string
      category: CoverageScenarioItem['category']
      currentAmount: number | null
      proposedAmount: number | null
      memo?: string
    }) => {
      if (formMode?.type !== 'edit') return
      mutate((current) => updateCoverageItem(current, formMode.itemId, patch))
    },
    patchCoverageItem: (
      itemId: string,
      patch: Partial<
        Pick<CoverageScenarioItem, 'label' | 'category' | 'currentAmount' | 'proposedAmount' | 'memo'>
      >,
    ) => {
      if (!scenario) return
      mutate((current) => updateCoverageItem(current, itemId, patch))
    },
    moveItem: (id: string, direction: 'up' | 'down') => {
      if (!scenario) return
      mutate((current) => moveScenarioItem(current, id, direction))
    },
    removeItem: (id: string) => {
      if (!scenario) return
      mutate((current) => removeScenarioItem(current, id))
    },
    linkCustomer: (customer: ConsultationCustomerDraft) => {
      mutate((current) => ({
        ...current,
        customerId: customer.customerId,
        customerNameSnapshot: customer.customerNameSnapshot,
        customerName: customer.customerNameSnapshot ?? undefined,
      }))
    },
    clearLinkedCustomer: () => {
      mutate((current) => ({
        ...current,
        ...emptyCustomerDraft(),
        customerName: undefined,
      }))
    },
    editorMode: 'consultation' as const,
  }
}

export type ScenarioEditorController = ReturnType<typeof useScenarioEditor>
