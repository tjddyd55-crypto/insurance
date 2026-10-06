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
import { formatConsultationListDate } from '../domain/formatConsultationDate'
import { startConsultationFromUserTemplate } from '../domain/startConsultation'
import type { SavedScenarioSummary } from '../domain/types'
import { useCoverageSimulatorCrmStorage } from '../context/CoverageSimulatorCrmStorageContext'
import { getScenarioTemplateById } from '../storage/templateRepository'
import {
  deleteScenarioAsync,
  listConsultationsByTemplateId,
  renameConsultationAsync,
} from '../storage/scenarioRepository'

function formatSimulationRowLabel(row: SavedScenarioSummary): string {
  const customer =
    row.customerNameSnapshot ?? row.customerName ?? '고객 미연결'
  const date = formatConsultationListDate(row.updatedAt)
  return `${row.title} / ${customer} / ${date}`
}

function TemplateSimulationListPageContent() {
  const navigate = useNavigate()
  const { templateId } = useParams()
  const { basePath, userKey } = useCoverageSimulatorScope()
  const { draft: customerDraft } = useCoverageSimulatorCustomer()
  const { confirm, confirmDialog } = useConfirmDialog()
  const { showToast } = useCoverageSimulatorToast()

  const template = templateId ? getScenarioTemplateById(userKey, templateId) : null

  const { version: storageVersion } = useCoverageSimulatorCrmStorage()
  const [listVersion, setListVersion] = useState(0)
  const [menuRow, setMenuRow] = useState<SavedScenarioSummary | null>(null)
  const [renameRow, setRenameRow] = useState<SavedScenarioSummary | null>(null)
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameValidationError, setRenameValidationError] = useState<string | null>(null)

  if (!templateId || !template) {
    return <Navigate to={basePath} replace />
  }

  const rows = useMemo(
    () => listConsultationsByTemplateId(userKey, templateId, customerDraft.customerId),
    [customerDraft.customerId, listVersion, storageVersion, templateId, userKey],
  )

  const refreshList = useCallback(() => {
    setListVersion((value) => value + 1)
  }, [])

  const openScenario = (id: string) => {
    navigate(`${basePath}/scenarios/${id}`)
  }

  const createNewSimulation = () => {
    const saved = startConsultationFromUserTemplate(userKey, template, customerDraft)
    navigate(`${basePath}/scenarios/${saved.id}`)
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
    })()
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
      await deleteScenarioAsync(userKey, row.id)
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
        <div className="coverage-simulator-appbar__title">{template.name}</div>
        <span />
      </header>
      <main className="coverage-simulator-content">
        <CustomerContextBar />
        <div className="cs-simulation-list__actions">
          <button type="button" className="coverage-simulator-primary-btn" onClick={createNewSimulation}>
            + 새 시뮬레이션 만들기
          </button>
        </div>
        <h2 className="cs-simulation-list__heading">저장된 시뮬레이션</h2>
        {rows.length === 0 ? (
          <p className="coverage-simulator-page-desc">저장된 시뮬레이션이 없습니다.</p>
        ) : (
          <div className="cs-simulation-list">
            {rows.map((row) => (
              <div key={row.id} className="cs-simulation-list__card">
                <button type="button" className="cs-simulation-list__card-main" onClick={() => openScenario(row.id)}>
                  <div className="cs-simulation-list__title">{formatSimulationRowLabel(row)}</div>
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

export function TemplateSimulationListPage() {
  return (
    <CoverageSimulatorToastProvider>
      <TemplateSimulationListPageContent />
    </CoverageSimulatorToastProvider>
  )
}
