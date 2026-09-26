import { useCallback, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { useConfirmDialog } from '../../../components/dialog'
import { CustomerContextBar } from '../components/CustomerContextBar'
import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import { CoverageSimulatorToastProvider, useCoverageSimulatorToast } from '../components/CoverageSimulatorToast'
import { SimulationListActionSheet } from '../components/SimulationListActionSheet'
import { SaveConsultationTitleDialog } from '../components/SaveConsultationTitleDialog'
import { useCoverageSimulatorCustomer } from '../context/CoverageSimulatorCustomerContext'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { diseaseTypeTitle, isKnownDiseaseType } from '../domain/diseaseTypeLabels'
import { formatConsultationListDate } from '../domain/formatConsultationDate'
import type { SavedScenarioSummary } from '../domain/types'
import {
  deleteScenario,
  listConsultationsByDisease,
  renameConsultation,
} from '../storage/scenarioRepository'

function SimulationListPageContent() {
  const navigate = useNavigate()
  const { diseaseType: diseaseTypeParam } = useParams()
  const { basePath, userKey } = useCoverageSimulatorScope()
  const { draft: customerDraft } = useCoverageSimulatorCustomer()
  const { confirm, confirmDialog } = useConfirmDialog()
  const { showToast } = useCoverageSimulatorToast()

  const [listVersion, setListVersion] = useState(0)
  const [menuRow, setMenuRow] = useState<SavedScenarioSummary | null>(null)
  const [renameRow, setRenameRow] = useState<SavedScenarioSummary | null>(null)
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameValidationError, setRenameValidationError] = useState<string | null>(null)

  if (!diseaseTypeParam || !isKnownDiseaseType(diseaseTypeParam)) {
    return <Navigate to={basePath} replace />
  }

  const diseaseType = diseaseTypeParam
  const title = diseaseTypeTitle(diseaseType)

  const rows = useMemo(
    () => listConsultationsByDisease(userKey, diseaseType, customerDraft.customerId),
    [customerDraft.customerId, diseaseType, listVersion, userKey],
  )

  const refreshList = useCallback(() => {
    setListVersion((value) => value + 1)
  }, [])

  const openScenario = (id: string) => {
    navigate(`${basePath}/scenarios/${id}`)
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
    try {
      const updated = renameConsultation(userKey, renameRow.id, trimmed)
      if (!updated) {
        showToast('제목을 수정하지 못했습니다. 다시 시도해 주세요.')
        return
      }
      setRenameRow(null)
      refreshList()
      showToast('제목이 수정되었습니다.')
    } catch {
      showToast('제목을 수정하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setRenameSaving(false)
    }
  }

  const requestDelete = async (row: SavedScenarioSummary) => {
    const accepted = await confirm({
      title: '이 시뮬레이션을 삭제할까요?',
      message: '저장된 보장 시뮬레이션이 삭제됩니다.',
      confirmLabel: '삭제',
      tone: 'danger',
    })
    if (!accepted) return
    try {
      deleteScenario(userKey, row.id)
      refreshList()
      showToast('삭제되었습니다.')
    } catch {
      showToast('삭제하지 못했습니다. 다시 시도해 주세요.')
    }
  }

  return (
    <CoverageSimulatorLayout>
      <header className="coverage-simulator-appbar coverage-simulator-appbar--compact">
        <button type="button" className="coverage-simulator-icon-btn" onClick={() => navigate(basePath)} aria-label="뒤로">
          ←
        </button>
        <div className="coverage-simulator-appbar__title">{title}</div>
        <span />
      </header>
      <main className="coverage-simulator-content">
        <CustomerContextBar />
        <h2 className="cs-simulation-list__heading">저장된 시뮬레이션</h2>
        {rows.length === 0 ? (
          <p className="coverage-simulator-page-desc">저장된 시뮬레이션이 없습니다.</p>
        ) : (
          <div className="cs-simulation-list">
            {rows.map((row) => (
              <div key={row.id} className="cs-simulation-list__card">
                <button type="button" className="cs-simulation-list__card-main" onClick={() => openScenario(row.id)}>
                  <div className="cs-simulation-list__title">{row.title}</div>
                  <div className="cs-simulation-list__meta">작성 {formatConsultationListDate(row.createdAt)}</div>
                  <div className="cs-simulation-list__meta">수정 {formatConsultationListDate(row.updatedAt)}</div>
                </button>
                <button
                  type="button"
                  className="cs-simulation-list__more"
                  aria-label={`${row.title} 메뉴`}
                  onClick={() => setMenuRow(row)}
                >
                  ⋯
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className="coverage-simulator-primary-btn cs-simulation-list__cta"
          onClick={() => navigate(`${basePath}/${diseaseType}/new`)}
        >
          + 새 시뮬레이션 만들기
        </button>
      </main>
      <SimulationListActionSheet
        open={menuRow != null}
        documentTitle={menuRow?.title ?? ''}
        onClose={() => setMenuRow(null)}
        onOpen={() => {
          if (!menuRow) return
          openScenario(menuRow.id)
        }}
        onRename={() => {
          if (!menuRow) return
          setRenameValidationError(null)
          setRenameRow(menuRow)
        }}
        onDelete={() => {
          if (!menuRow) return
          void requestDelete(menuRow)
        }}
      />
      <SaveConsultationTitleDialog
        open={renameRow != null}
        dialogTitle="제목 수정"
        initialTitle={renameRow?.title ?? ''}
        validationError={renameValidationError}
        saving={renameSaving}
        onClose={() => {
          if (renameSaving) return
          setRenameRow(null)
          setRenameValidationError(null)
        }}
        onConfirm={handleRenameConfirm}
      />
      {confirmDialog}
    </CoverageSimulatorLayout>
  )
}

export function SimulationListPage() {
  return (
    <CoverageSimulatorToastProvider>
      <SimulationListPageContent />
    </CoverageSimulatorToastProvider>
  )
}
