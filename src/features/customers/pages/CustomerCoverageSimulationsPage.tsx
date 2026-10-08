import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import { getCustomerById } from '../api/customersApi'
import {
  CoverageSimulatorScopeProvider,
  useCoverageSimulatorScope,
} from '../../coverage-simulator/CoverageSimulatorScope'
import { CoverageEditorPanelShell } from '../../coverage-simulator/components/CoverageEditorPanelShell'
import { CoverageEditorSsot } from '../../coverage-simulator/components/CoverageEditorSsot'
import { CoverageSimulatorToastProvider, useCoverageSimulatorToast } from '../../coverage-simulator/components/CoverageSimulatorToast'
import { SimulationCustomerField } from '../../coverage-simulator/components/SimulationCustomerField'
import { SimulationListPanel } from '../../coverage-simulator/components/SimulationListPanel'
import {
  CoverageSimulatorCrmStorageProvider,
  useCoverageSimulatorCrmStorage,
} from '../../coverage-simulator/context/CoverageSimulatorCrmStorageContext'
import { CoverageSimulatorCustomerProvider } from '../../coverage-simulator/context/CoverageSimulatorCustomerContext'
import { startConsultationFromUserTemplate } from '../../coverage-simulator/domain/startConsultation'
import { useScenarioEditor } from '../../coverage-simulator/hooks/useScenarioEditor'
import {
  getScenarioTemplateById,
  listScenarioTemplates,
} from '../../coverage-simulator/storage/templateRepository'
import { listConsultationsByTemplateId } from '../../coverage-simulator/storage/consultationRepository'

import '../../coverage-simulator/styles/tokens.css'
import '../../coverage-simulator/styles/simulation-list-panel.css'
import '../../coverage-simulator/styles/coverage-three-pane.css'

type View =
  | { mode: 'list' }
  | { mode: 'detail'; simulationId: string }

function CustomerCoverageSimulationsPanel({
  customerId,
  customerName,
}: {
  customerId: number
  customerName?: string | null
}) {
  const customerIdStr = String(customerId)
  const { userKey } = useCoverageSimulatorScope()
  const { version: storageVersion } = useCoverageSimulatorCrmStorage()
  const { showToast } = useCoverageSimulatorToast()
  const [view, setView] = useState<View>({ mode: 'list' })
  const [listVersion, setListVersion] = useState(0)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const templates = useMemo(
    () => listScenarioTemplates(userKey),
    [userKey, storageVersion],
  )

  const simulationRows = useMemo(() => {
    if (!selectedTemplateId) {
      return []
    }
    void listVersion
    void storageVersion
    return listConsultationsByTemplateId(userKey, selectedTemplateId, customerIdStr)
  }, [customerIdStr, listVersion, selectedTemplateId, storageVersion, userKey])

  const selectedTemplate = selectedTemplateId
    ? getScenarioTemplateById(userKey, selectedTemplateId)
    : null

  const editor = useScenarioEditor({
    scenarioIdOverride: view.mode === 'detail' ? view.simulationId : null,
    embedded: true,
    onSaved: () => setListVersion((v) => v + 1),
  })

  const refresh = useCallback(() => setListVersion((v) => v + 1), [])

  const createSimulationForTemplate = () => {
    if (!selectedTemplate) {
      return
    }
    void (async () => {
      try {
        const saved = await startConsultationFromUserTemplate(userKey, selectedTemplate, {
          customerId: customerIdStr,
          customerNameSnapshot: customerName?.trim() || null,
        })
        refresh()
        setView({ mode: 'detail', simulationId: saved.id })
      } catch {
        showToast('시뮬레이션을 만들지 못했습니다.')
      }
    })()
  }

  if (view.mode === 'detail') {
    return (
      <div
        className="coverage-simulator-root coverage-simulator-root--crm customer-coverage-simulations customer-coverage-simulations--detail"
      >
        <header className="customer-coverage-simulations__toolbar">
          <button type="button" className="customer-coverage-simulations__back" onClick={() => setView({ mode: 'list' })}>
            ← 목록
          </button>
        </header>
        <CoverageEditorPanelShell
          beforeEditor={<SimulationCustomerField editor={editor} readOnlyCustomer />}
        >
          <CoverageEditorSsot editor={editor} />
        </CoverageEditorPanelShell>
      </div>
    )
  }

  return (
    <div className="coverage-simulator-root coverage-simulator-root--crm customer-coverage-simulations customer-coverage-simulations--workspace">
      <header className="customer-coverage-simulations__toolbar">
        <h2 className="customer-coverage-simulations__heading">시뮬레이션</h2>
      </header>

      <div className="cs-three-pane cs-three-pane--customer-embedded" data-testid="customer-coverage-three-pane">
        <aside className="cs-three-pane__column cs-three-pane__column--scenario">
          <header className="cs-three-pane__column-header">
            <h2>시나리오</h2>
          </header>
          <div className="cs-three-pane__scroll">
            {templates.length === 0 ? (
              <p className="cs-three-pane__empty-list">등록된 시나리오가 없습니다.</p>
            ) : (
              templates.map((template) => (
                <div key={template.id} className="cs-three-pane-scenario-row">
                  <button
                    type="button"
                    className={`cs-three-pane-scenario-row__main${
                      selectedTemplateId === template.id ? ' cs-three-pane-scenario-row__main--active' : ''
                    }`}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <span className="cs-three-pane-scenario-row__title">{template.name}</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <aside className="cs-three-pane__column cs-three-pane__column--simulation">
          <header className="cs-three-pane__column-header">
            <h2>시뮬레이션</h2>
            <button
              type="button"
              className="cs-three-pane__add"
              disabled={!selectedTemplate}
              onClick={createSimulationForTemplate}
            >
              + 추가
            </button>
          </header>
          <div className="cs-three-pane__scroll">
            {!selectedTemplateId ? (
              <p className="cs-three-pane-empty">시나리오를 선택해 주세요</p>
            ) : (
              <SimulationListPanel
                rows={simulationRows}
                emptyMessage="연결된 시뮬레이션이 없습니다."
                onSelect={(id) => setView({ mode: 'detail', simulationId: id })}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function CustomerCoverageSimulationsPageInner() {
  const { customerId } = useParams()
  const { token } = useAuth()
  const resolved = Number(customerId)
  const [customerName, setCustomerName] = useState<string | null>(null)

  useEffect(() => {
    if (!token?.trim() || !Number.isInteger(resolved) || resolved <= 0) {
      setCustomerName(null)
      return
    }
    void getCustomerById(token, resolved)
      .then((row) => setCustomerName(row.name))
      .catch(() => setCustomerName(null))
  }, [resolved, token])

  if (!Number.isInteger(resolved) || resolved <= 0) {
    return (
      <div className="coverage-simulator-root coverage-simulator-root--crm customer-coverage-simulations">
        <p className="customer-coverage-simulations__empty">고객을 선택해 주세요.</p>
      </div>
    )
  }
  return <CustomerCoverageSimulationsPanel customerId={resolved} customerName={customerName} />
}

export default function CustomerCoverageSimulationsPage() {
  const { user } = useAuth()
  const userKey = user?.id ?? 'guest'

  return (
    <CoverageSimulatorScopeProvider basePath="/coverage-simulator" userKey={userKey} layoutMode="crm">
      <CoverageSimulatorCustomerProvider>
        <CoverageSimulatorCrmStorageProvider>
          <CoverageSimulatorToastProvider>
            <CustomerCoverageSimulationsPageInner />
          </CoverageSimulatorToastProvider>
        </CoverageSimulatorCrmStorageProvider>
      </CoverageSimulatorCustomerProvider>
    </CoverageSimulatorScopeProvider>
  )
}
