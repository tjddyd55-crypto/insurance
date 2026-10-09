import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import useIsMobile from '../../../hooks/useIsMobile'
import { useConfirmDialog } from '../../../components/dialog'
import { CoverageEditorPanelShell } from './CoverageEditorPanelShell'
import { CoverageEditorSsot } from './CoverageEditorSsot'
import { CoverageSimulatorLayout } from './CoverageSimulatorLayout'
import { useCoverageSimulatorToast } from './CoverageSimulatorToast'
import { SimulationCustomerField } from './SimulationCustomerField'
import { SimulationListActionSheet } from './SimulationListActionSheet'
import { CoverageSimulatorNameCreateDialog } from './CoverageSimulatorNameCreateDialog'
import { SaveConsultationTitleDialog } from './SaveConsultationTitleDialog'
import { coverageSimulatorExitPath, useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { CoverageThreePaneEditorNavigationProvider } from '../context/CoverageThreePaneEditorNavigation'
import { formatConsultationListDate } from '../domain/formatConsultationDate'
import { emptyCustomerDraft } from '../domain/customerContext'
import { cloneUserTemplate, createEmptyUserTemplate } from '../domain/templateOperations'
import { startConsultationFromUserTemplate } from '../domain/startConsultation'
import type { SavedScenarioSummary } from '../domain/types'
import { useCoverageSimulatorCrmStorage } from '../context/CoverageSimulatorCrmStorageContext'
import { useScenarioEditor } from '../hooks/useScenarioEditor'
import { useTemplateEditor } from '../hooks/useTemplateEditor'
import {
  deleteScenarioTemplate,
  getScenarioTemplateById,
  listScenarioTemplates,
  saveScenarioTemplate,
} from '../storage/templateRepository'
import {
  deleteScenarioAsync,
  listConsultationsByTemplateId,
  renameConsultationAsync,
} from '../storage/scenarioRepository'

import { CoverageEmbeddedPdfPreview } from './CoverageEmbeddedPdfPreview'

import '../styles/coverage-three-pane.css'

type ContentMode =
  | { type: 'empty' }
  | { type: 'simulation'; simulationId: string }
  | { type: 'template-edit'; templateId: string }
  | { type: 'pdf'; scenarioId: string }

type WorkspaceLocationState = {
  openPdfScenarioId?: string
}

export type CoverageThreePaneCustomerFilter = {
  customerId: string
  customerName?: string | null
  readOnlyCustomerField?: boolean
}

export type CoverageThreePaneWorkspaceProps = {
  density?: 'default' | 'compact'
  customerFilter?: CoverageThreePaneCustomerFilter
  /** PC 고객 workspace — 시나리오와 동일한 row anchored popover */
  simulationMenuMode?: 'sheet' | 'popover'
  showAppBar?: boolean
  paneClassName?: string
  initialTemplateId?: string | null
  initialSimulationId?: string | null
  onWorkspaceSelectionChange?: (selection: {
    templateId: string | null
    simulationId: string | null
  }) => void
}

function simulationRowCustomerLabel(row: SavedScenarioSummary): string {
  return row.customerNameSnapshot ?? row.customerName ?? '미연결'
}

function simulationRowTitleLabel(row: SavedScenarioSummary): string {
  const title = row.title?.trim()
  return title || '제목 없음'
}

export function CoverageThreePaneWorkspace({
  density = 'default',
  customerFilter,
  simulationMenuMode = 'sheet',
  showAppBar = true,
  paneClassName = '',
  initialTemplateId = null,
  initialSimulationId = null,
  onWorkspaceSelectionChange,
}: CoverageThreePaneWorkspaceProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const { basePath, userKey, layoutMode, isPublicPreview } = useCoverageSimulatorScope()
  const { version: storageVersion } = useCoverageSimulatorCrmStorage()
  const { confirm, confirmDialog } = useConfirmDialog()
  const { showToast } = useCoverageSimulatorToast()

  const [templateVersion, setTemplateVersion] = useState(0)
  const templates = useMemo(
    () => listScenarioTemplates(userKey),
    [userKey, storageVersion, templateVersion],
  )
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    () => initialTemplateId ?? templates[0]?.id ?? null,
  )
  const [contentMode, setContentMode] = useState<ContentMode>(() => {
    if (initialSimulationId) {
      return { type: 'simulation', simulationId: initialSimulationId }
    }
    return { type: 'empty' }
  })
  const [listVersion, setListVersion] = useState(0)
  const [templateMenuId, setTemplateMenuId] = useState<string | null>(null)
  const [simulationMenuRow, setSimulationMenuRow] = useState<SavedScenarioSummary | null>(null)
  const [renameRow, setRenameRow] = useState<SavedScenarioSummary | null>(null)
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameValidationError, setRenameValidationError] = useState<string | null>(null)
  const [addScenarioOpen, setAddScenarioOpen] = useState(false)
  const [newScenarioName, setNewScenarioName] = useState('')
  const [addSimulationOpen, setAddSimulationOpen] = useState(false)
  const [newSimulationName, setNewSimulationName] = useState('')
  const [renameTemplateId, setRenameTemplateId] = useState<string | null>(null)
  const [renameTemplateError, setRenameTemplateError] = useState<string | null>(null)
  const rowMenuDismissEnabled = Boolean(customerFilter) || simulationMenuMode === 'popover'

  useEffect(() => {
    if (!rowMenuDismissEnabled) return
    if (!templateMenuId && !simulationMenuRow) return

    const closeRowMenus = () => {
      setTemplateMenuId(null)
      setSimulationMenuRow(null)
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-cs-three-pane-row-menu-root="true"]')) return
      if (target.closest('.coverage-simulator-overlay')) return
      if (target.closest('[role="dialog"]')) return
      closeRowMenus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (addScenarioOpen || addSimulationOpen || renameRow || renameTemplateId) return
      closeRowMenus()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [
    addScenarioOpen,
    addSimulationOpen,
    renameRow,
    renameTemplateId,
    rowMenuDismissEnabled,
    simulationMenuRow,
    templateMenuId,
  ])

  const notifySelection = useCallback(
    (templateId: string | null, simulationId: string | null) => {
      onWorkspaceSelectionChange?.({ templateId, simulationId })
    },
    [onWorkspaceSelectionChange],
  )

  useEffect(() => {
    if (initialTemplateId) {
      setSelectedTemplateId(initialTemplateId)
    }
  }, [initialTemplateId])

  useEffect(() => {
    if (initialSimulationId) {
      setContentMode({ type: 'simulation', simulationId: initialSimulationId })
      return
    }
    setContentMode((current) => (current.type === 'simulation' ? { type: 'empty' } : current))
  }, [initialSimulationId])

  useEffect(() => {
    if (templates.length === 0) return
    if (selectedTemplateId && templates.some((t) => t.id === selectedTemplateId)) return

    if (initialTemplateId && templates.some((t) => t.id === initialTemplateId)) {
      setSelectedTemplateId(initialTemplateId)
      if (initialSimulationId) {
        setContentMode({ type: 'simulation', simulationId: initialSimulationId })
      }
      return
    }

    const nextTemplateId = templates[0]?.id ?? null
    if (nextTemplateId === selectedTemplateId) return
    setSelectedTemplateId(nextTemplateId)
    setContentMode({ type: 'empty' })
    notifySelection(nextTemplateId, null)
  }, [
    initialSimulationId,
    initialTemplateId,
    notifySelection,
    selectedTemplateId,
    templates,
  ])

  const selectedTemplate = selectedTemplateId ? getScenarioTemplateById(userKey, selectedTemplateId) : null

  const simulationRows = useMemo(() => {
    if (!selectedTemplateId) return []
    void listVersion
    void storageVersion
    return listConsultationsByTemplateId(
      userKey,
      selectedTemplateId,
      customerFilter?.customerId ?? null,
    )
  }, [customerFilter?.customerId, listVersion, selectedTemplateId, storageVersion, userKey])

  const refreshLists = useCallback(() => setListVersion((v) => v + 1), [])

  const simulationEditor = useScenarioEditor({
    scenarioIdOverride: contentMode.type === 'simulation' ? contentMode.simulationId : null,
    embedded: true,
    onSaved: () => refreshLists(),
  })

  const templateEditor = useTemplateEditor({
    templateIdOverride: contentMode.type === 'template-edit' ? contentMode.templateId : null,
    embedded: true,
  })

  const bumpTemplateList = useCallback(() => {
    setTemplateVersion((v) => v + 1)
  }, [])

  const activeSimulationId =
    contentMode.type === 'simulation'
      ? contentMode.simulationId
      : contentMode.type === 'pdf'
        ? contentMode.scenarioId
        : null

  const isSimulationRowActive = (simulationId: string) => activeSimulationId === simulationId

  const openPdfInPane = useCallback((scenarioId: string) => {
    setContentMode({ type: 'pdf', scenarioId })
    notifySelection(selectedTemplateId, scenarioId)
  }, [notifySelection, selectedTemplateId])

  const closePdfInPane = useCallback(() => {
    if (contentMode.type === 'pdf') {
      setContentMode({ type: 'simulation', simulationId: contentMode.scenarioId })
      notifySelection(selectedTemplateId, contentMode.scenarioId)
      return
    }
    if (activeSimulationId) {
      setContentMode({ type: 'simulation', simulationId: activeSimulationId })
    }
  }, [activeSimulationId, contentMode, notifySelection, selectedTemplateId])

  useEffect(() => {
    const state = location.state as WorkspaceLocationState | null
    const scenarioId = state?.openPdfScenarioId?.trim()
    if (!scenarioId) return
    setContentMode({ type: 'pdf', scenarioId })
    notifySelection(selectedTemplateId, scenarioId)
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: {} },
    )
  }, [location.pathname, location.search, location.state, navigate, notifySelection, selectedTemplateId])

  const selectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId)
    setContentMode({ type: 'empty' })
    setTemplateMenuId(null)
    notifySelection(templateId, null)
  }

  const openSimulation = (simulationId: string) => {
    setContentMode({ type: 'simulation', simulationId })
    setSimulationMenuRow(null)
    notifySelection(selectedTemplateId, simulationId)
  }

  const openTemplateEdit = (templateId: string) => {
    setContentMode({ type: 'template-edit', templateId })
    setTemplateMenuId(null)
    notifySelection(templateId, null)
  }

  const clearContentSelection = useCallback(() => {
    setContentMode({ type: 'empty' })
    notifySelection(selectedTemplateId, null)
  }, [notifySelection, selectedTemplateId])

  const openAddSimulationModal = () => {
    if (!selectedTemplate) return
    setNewSimulationName(selectedTemplate.name)
    setAddSimulationOpen(true)
  }

  const onCreateSimulation = async (name: string) => {
    if (!selectedTemplate) return
    try {
      const customerDraft = customerFilter
        ? {
            customerId: customerFilter.customerId,
            customerNameSnapshot: customerFilter.customerName?.trim() || null,
          }
        : emptyCustomerDraft()
      const saved = await startConsultationFromUserTemplate(userKey, selectedTemplate, customerDraft)
      const renamed = await renameConsultationAsync(userKey, saved.id, name)
      setAddSimulationOpen(false)
      setNewSimulationName('')
      refreshLists()
      openSimulation(renamed?.id ?? saved.id)
    } catch {
      showToast('시뮬레이션을 만들지 못했습니다.')
    }
  }

  const onCreateScenario = (name: string) => {
    const saved = saveScenarioTemplate(userKey, createEmptyUserTemplate(name))
    setAddScenarioOpen(false)
    setNewScenarioName('')
    bumpTemplateList()
    selectTemplate(saved.id)
    openTemplateEdit(saved.id)
  }

  const onDeleteTemplate = async (templateId: string) => {
    const ok = await confirm({
      title: '시나리오를 삭제할까요?',
      message: '이 시나리오를 삭제합니다. 이미 저장된 시뮬레이션은 영향을 받지 않습니다.',
      confirmLabel: '삭제',
      tone: 'danger',
    })
    if (!ok) return
    deleteScenarioTemplate(userKey, templateId)
    setTemplateMenuId(null)
    bumpTemplateList()
    if (selectedTemplateId === templateId) {
      const remaining = listScenarioTemplates(userKey)
      const nextTemplateId = remaining[0]?.id ?? null
      setSelectedTemplateId(nextTemplateId)
      setContentMode({ type: 'empty' })
      notifySelection(nextTemplateId, null)
    }
  }

  const onRenameTemplateConfirm = (nextName: string) => {
    if (!renameTemplateId) return
    const source = getScenarioTemplateById(userKey, renameTemplateId)
    if (!source) {
      setRenameTemplateId(null)
      return
    }
    const trimmed = nextName.trim()
    if (!trimmed) {
      setRenameTemplateError('시나리오 이름을 입력해 주세요.')
      return
    }
    if (trimmed === source.name.trim()) {
      setRenameTemplateId(null)
      setRenameTemplateError(null)
      return
    }
    saveScenarioTemplate(userKey, { ...source, name: trimmed })
    bumpTemplateList()
    setRenameTemplateId(null)
    setRenameTemplateError(null)
    setTemplateMenuId(null)
  }

  const handleRenameConfirm = (nextTitle: string) => {
    if (!renameRow) return
    const trimmed = nextTitle.trim()
    if (!trimmed) {
      setRenameValidationError('제목을 입력해 주세요.')
      return
    }
    setRenameSaving(true)
    setRenameValidationError(null)
    void (async () => {
      try {
        const updated = await renameConsultationAsync(userKey, renameRow.id, trimmed)
        if (!updated) {
          showToast('제목을 수정하지 못했습니다.')
          return
        }
        setRenameRow(null)
        refreshLists()
        showToast('제목이 수정되었습니다.')
      } catch {
        showToast('제목을 수정하지 못했습니다.')
      } finally {
        setRenameSaving(false)
      }
    })()
  }

  const requestDeleteSimulation = async (row: SavedScenarioSummary) => {
    const accepted = await confirm({
      title: '이 시뮬레이션을 삭제할까요?',
      message: '저장된 보장 시뮬레이션이 삭제됩니다.',
      confirmLabel: '삭제',
      tone: 'danger',
    })
    if (!accepted) return
    try {
      await deleteScenarioAsync(userKey, row.id)
      if (isSimulationRowActive(row.id)) {
        setContentMode({ type: 'empty' })
        notifySelection(selectedTemplateId, null)
      }
      refreshLists()
      showToast('삭제되었습니다.')
    } catch {
      showToast('삭제하지 못했습니다.')
    }
  }

  const addScenarioLabel = '+ 추가'
  const addSimulationLabel = '+ 추가'
  const showScenarioMeta = density !== 'compact'
  const useTitlePrimary = Boolean(customerFilter)

  const paneDensityClass =
    density === 'compact' ? 'cs-three-pane--density-compact' : 'cs-three-pane--density-default'
  const effectiveSimulationMenuMode = isMobile ? simulationMenuMode : 'popover'

  if (isMobile && layoutMode !== 'preview-pc') {
    return null
  }

  const contentColumnClassName = [
    'cs-three-pane__column',
    'cs-three-pane__column--content',
    contentMode.type === 'pdf' ? 'cs-three-pane__column--content-pdf' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const contentPane = (() => {
    if (!selectedTemplateId) {
      return (
        <div className="cs-three-pane-empty">
          <p>시나리오를 선택해 주세요.</p>
        </div>
      )
    }
    if (contentMode.type === 'pdf') {
      return (
        <CoverageEmbeddedPdfPreview
          scenarioId={contentMode.scenarioId}
          onClose={closePdfInPane}
        />
      )
    }
    if (contentMode.type === 'simulation') {
      return (
        <CoverageEditorPanelShell
          beforeEditor={
            <SimulationCustomerField
              editor={simulationEditor}
              readOnlyCustomer={customerFilter?.readOnlyCustomerField}
            />
          }
        >
          <CoverageEditorSsot editor={simulationEditor} />
        </CoverageEditorPanelShell>
      )
    }
    if (contentMode.type === 'template-edit') {
      return (
        <CoverageEditorPanelShell>
          <CoverageEditorSsot editor={templateEditor} />
        </CoverageEditorPanelShell>
      )
    }
    return (
      <div className="cs-three-pane-empty">
        <p>시뮬레이션을 선택하거나 새로 만들어 주세요.</p>
      </div>
    )
  })()

  const editorNavValue = useMemo(
    () => ({
      onBackFromEditor: clearContentSelection,
      hideEditorBack: false,
    }),
    [clearContentSelection],
  )

  const editorNavValueWithPdf = useMemo(
    () => ({
      ...editorNavValue,
      openPdfInPane,
    }),
    [editorNavValue, openPdfInPane],
  )

  const pdfReturnTo = `${basePath}${location.search}`

  return (
    <CoverageThreePaneEditorNavigationProvider value={editorNavValueWithPdf}>
      <CoverageSimulatorLayout shellClassName={showAppBar ? 'coverage-simulator-shell--three-pane' : undefined}>
        {showAppBar ? (
          <header className="coverage-simulator-appbar coverage-simulator-appbar--compact">
            {isPublicPreview ? (
              <span className="coverage-simulator-icon-btn" aria-hidden="true" />
            ) : (
              <button
                type="button"
                className="coverage-simulator-icon-btn"
                onClick={() => navigate(coverageSimulatorExitPath(basePath))}
                aria-label="나가기"
              >
                ←
              </button>
            )}
            <div className="coverage-simulator-appbar__title">보장 시뮬레이션</div>
            <span />
          </header>
        ) : null}

        <div
          className={`cs-three-pane ${paneDensityClass} ${paneClassName}`.trim()}
          data-testid="coverage-three-pane"
          data-pdf-return-to={pdfReturnTo}
          data-active-simulation-id={activeSimulationId ?? ''}
        >
          <aside className="cs-three-pane__column cs-three-pane__column--scenario">
            <header className="cs-three-pane__column-header">
              <h2>시나리오</h2>
              <button type="button" className="cs-three-pane__add" onClick={() => setAddScenarioOpen(true)}>
                {addScenarioLabel}
              </button>
            </header>
            <div className="cs-three-pane__scroll">
              {templates.map((template) => (
                <div
                key={template.id}
                className="cs-three-pane-scenario-row"
                data-cs-three-pane-row-menu-root="true"
              >
                  <button
                    type="button"
                    className={`cs-three-pane-scenario-row__main${
                      selectedTemplateId === template.id ? ' cs-three-pane-scenario-row__main--active' : ''
                    }`}
                    onClick={() => selectTemplate(template.id)}
                  >
                    <span className="cs-three-pane-scenario-row__title">{template.name}</span>
                    {showScenarioMeta ? (
                      <span className="cs-three-pane-scenario-row__meta">
                        {template.itemCount}개 · {template.updatedAt.slice(0, 10)}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="cs-three-pane-scenario-row__menu"
                    aria-label="시나리오 메뉴"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSimulationMenuRow(null)
                      setTemplateMenuId(templateMenuId === template.id ? null : template.id)
                    }}
                  >
                    ⋯
                  </button>
                  {templateMenuId === template.id ? (
                    <div className="cs-three-pane-scenario-row__menu-panel" role="menu">
                      <button type="button" onClick={() => openTemplateEdit(template.id)}>
                        기본값 편집
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const source = getScenarioTemplateById(userKey, template.id)
                          if (!source) return
                          const copy = saveScenarioTemplate(userKey, cloneUserTemplate(source))
                          setTemplateMenuId(null)
                          bumpTemplateList()
                          selectTemplate(copy.id)
                          openTemplateEdit(copy.id)
                        }}
                      >
                        복제
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenameTemplateError(null)
                          setRenameTemplateId(template.id)
                          setTemplateMenuId(null)
                        }}
                      >
                        이름 변경
                      </button>
                      <button
                        type="button"
                        className="cs-axis-row-menu__danger"
                        onClick={() => void onDeleteTemplate(template.id)}
                      >
                        삭제
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </aside>

          <aside className="cs-three-pane__column cs-three-pane__column--simulation">
            <header className="cs-three-pane__column-header">
              <h2>{selectedTemplate ? `${selectedTemplate.name} 시뮬레이션` : '시뮬레이션'}</h2>
              <button
                type="button"
                className="cs-three-pane__add"
                disabled={!selectedTemplate}
                onClick={openAddSimulationModal}
              >
                {addSimulationLabel}
              </button>
            </header>
            <div className="cs-three-pane__scroll">
              {!selectedTemplateId ? (
                <p className="cs-three-pane__empty-list">시나리오를 선택해 주세요.</p>
              ) : simulationRows.length === 0 ? (
                <p className="cs-three-pane__empty-list">저장된 시뮬레이션이 없습니다.</p>
              ) : (
                simulationRows.map((row) => (
                  <div
                    key={row.id}
                    className="cs-three-pane-simulation-row"
                    data-cs-three-pane-row-menu-root="true"
                  >
                    <button
                      type="button"
                      className={`cs-three-pane-simulation-row__main${
                        isSimulationRowActive(row.id)
                          ? ' cs-three-pane-simulation-row__main--active'
                          : ''
                      }`}
                      onClick={() => openSimulation(row.id)}
                    >
                      <span className="cs-three-pane-simulation-row__customer">
                        {useTitlePrimary ? simulationRowTitleLabel(row) : simulationRowCustomerLabel(row)}
                      </span>
                      <span className="cs-three-pane-simulation-row__date">
                        {useTitlePrimary
                          ? `수정 ${formatConsultationListDate(row.updatedAt)}`
                          : formatConsultationListDate(row.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="cs-three-pane-simulation-row__menu"
                      aria-label="시뮬레이션 메뉴"
                      onClick={(event) => {
                        event.stopPropagation()
                        setTemplateMenuId(null)
                        setSimulationMenuRow((current) => (current?.id === row.id ? null : row))
                      }}
                    >
                      ⋯
                    </button>
                    {effectiveSimulationMenuMode === 'popover' && simulationMenuRow?.id === row.id ? (
                      <div className="cs-three-pane-scenario-row__menu-panel" role="menu">
                        <button
                          type="button"
                          onClick={() => {
                            openSimulation(row.id)
                            setSimulationMenuRow(null)
                          }}
                        >
                          열기
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenameValidationError(null)
                            setRenameRow(row)
                            setSimulationMenuRow(null)
                          }}
                        >
                          제목 수정
                        </button>
                        <button
                          type="button"
                          className="cs-axis-row-menu__danger"
                          onClick={() => {
                            setSimulationMenuRow(null)
                            void requestDeleteSimulation(row)
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </aside>

          <section className={contentColumnClassName}>{contentPane}</section>
        </div>

        {effectiveSimulationMenuMode === 'sheet' ? (
          <SimulationListActionSheet
            open={simulationMenuRow != null}
            documentTitle={simulationMenuRow?.title ?? ''}
            onClose={() => setSimulationMenuRow(null)}
            onOpen={() => {
              if (!simulationMenuRow) return
              openSimulation(simulationMenuRow.id)
            }}
            onRename={() => {
              if (!simulationMenuRow) return
              setRenameValidationError(null)
              setRenameRow(simulationMenuRow)
            }}
            onDelete={() => {
              if (!simulationMenuRow) return
              void requestDeleteSimulation(simulationMenuRow)
            }}
          />
        ) : null}

        <SaveConsultationTitleDialog
          open={renameRow != null}
          dialogTitle="시뮬레이션 제목 수정"
          initialTitle={renameRow?.title ?? ''}
          validationError={renameValidationError}
          saving={renameSaving}
          onClose={() => {
            setRenameRow(null)
            setRenameValidationError(null)
          }}
          onConfirm={handleRenameConfirm}
        />

        <CoverageSimulatorNameCreateDialog
          open={renameTemplateId != null}
          dialogTitle="시나리오 이름 변경"
          fieldLabel="시나리오 이름"
          confirmLabel="저장"
          initialValue={
            renameTemplateId
              ? getScenarioTemplateById(userKey, renameTemplateId)?.name ?? ''
              : ''
          }
          errorMessage={renameTemplateError}
          onClose={() => {
            setRenameTemplateId(null)
            setRenameTemplateError(null)
          }}
          onConfirm={onRenameTemplateConfirm}
        />

        <CoverageSimulatorNameCreateDialog
          open={addScenarioOpen}
          dialogTitle="시나리오 추가"
          fieldLabel="시나리오 이름"
          initialValue={newScenarioName}
          onClose={() => {
            setAddScenarioOpen(false)
            setNewScenarioName('')
          }}
          onConfirm={onCreateScenario}
        />

        <CoverageSimulatorNameCreateDialog
          open={addSimulationOpen}
          dialogTitle="시뮬레이션 추가"
          fieldLabel="시뮬레이션 이름"
          initialValue={newSimulationName}
          onClose={() => {
            setAddSimulationOpen(false)
            setNewSimulationName('')
          }}
          onConfirm={onCreateSimulation}
        />

        {confirmDialog}
      </CoverageSimulatorLayout>
    </CoverageThreePaneEditorNavigationProvider>
  )
}
