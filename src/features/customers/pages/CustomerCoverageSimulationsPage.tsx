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
import {
  CoverageSimulatorCrmStorageProvider,
  useCoverageSimulatorCrmStorage,
} from '../../coverage-simulator/context/CoverageSimulatorCrmStorageContext'
import { CoverageSimulatorCustomerProvider } from '../../coverage-simulator/context/CoverageSimulatorCustomerContext'
import { SimulationListPanel } from '../../coverage-simulator/components/SimulationListPanel'
import { startConsultationFromUserTemplate } from '../../coverage-simulator/domain/startConsultation'
import { useScenarioEditor } from '../../coverage-simulator/hooks/useScenarioEditor'
import { listConsultationsByCustomerId } from '../../coverage-simulator/storage/consultationRepository'
import {
  getScenarioTemplateById,
  listScenarioTemplates,
} from '../../coverage-simulator/storage/templateRepository'

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
  const [scenarioPickerOpen, setScenarioPickerOpen] = useState(false)

  const rows = useMemo(() => {
    void listVersion
    void storageVersion
    return listConsultationsByCustomerId(userKey, customerIdStr)
  }, [customerIdStr, listVersion, storageVersion, userKey])

  const editor = useScenarioEditor({
    scenarioIdOverride: view.mode === 'detail' ? view.simulationId : null,
    embedded: true,
    onSaved: () => setListVersion((v) => v + 1),
  })

  const refresh = useCallback(() => setListVersion((v) => v + 1), [])

  const createFromTemplate = (templateId: string) => {
    const template = getScenarioTemplateById(userKey, templateId)
    if (!template) return
    void (async () => {
      try {
        const saved = await startConsultationFromUserTemplate(userKey, template, {
          customerId: customerIdStr,
          customerNameSnapshot: customerName?.trim() || null,
        })
        refresh()
        setView({ mode: 'detail', simulationId: saved.id })
        setScenarioPickerOpen(false)
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

  const templates = listScenarioTemplates(userKey)

  return (
    <div className="coverage-simulator-root coverage-simulator-root--crm customer-coverage-simulations">
      <header className="customer-coverage-simulations__toolbar">
        <h2 className="customer-coverage-simulations__heading">시뮬레이션</h2>
      </header>
      <div className="cs-simulation-list__actions">
        <button
          type="button"
          className="coverage-simulator-primary-btn customer-coverage-simulations__add-primary"
          onClick={() => setScenarioPickerOpen(true)}
        >
          + 시뮬레이션 추가
        </button>
      </div>
      <h3 className="cs-simulation-list__heading">저장된 시뮬레이션</h3>
      <SimulationListPanel
        rows={rows}
        emptyMessage="연결된 시뮬레이션이 없습니다."
        onSelect={(id) => setView({ mode: 'detail', simulationId: id })}
      />

      {scenarioPickerOpen ? (
        <div className="coverage-simulator-overlay" role="presentation" onClick={() => setScenarioPickerOpen(false)}>
          <div className="coverage-simulator-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className="coverage-simulator-dialog__title">시나리오 선택</h2>
            <ul className="customer-coverage-simulations__scenario-pick">
              {templates.map((template) => (
                <li key={template.id}>
                  <button type="button" onClick={() => createFromTemplate(template.id)}>
                    {template.name}
                  </button>
                </li>
              ))}
            </ul>
            <div className="coverage-simulator-dialog__actions">
              <button type="button" className="coverage-simulator-secondary-btn" onClick={() => setScenarioPickerOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
