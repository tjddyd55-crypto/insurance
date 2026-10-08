import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useParams, useSearchParams } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import { getCustomerById } from '../api/customersApi'
import {
  CoverageSimulatorScopeProvider,
  useCoverageSimulatorScope,
} from '../../coverage-simulator/CoverageSimulatorScope'
import { CoverageThreePaneWorkspace } from '../../coverage-simulator/components/CoverageThreePaneWorkspace'
import { CoverageSimulatorToastProvider } from '../../coverage-simulator/components/CoverageSimulatorToast'
import {
  CoverageSimulatorCrmStorageProvider,
} from '../../coverage-simulator/context/CoverageSimulatorCrmStorageContext'
import { CoverageSimulatorCustomerProvider } from '../../coverage-simulator/context/CoverageSimulatorCustomerContext'

import '../../coverage-simulator/styles/tokens.css'
import '../../coverage-simulator/styles/coverage-three-pane.css'

function customerCoverageBasePath(customerId: number): string {
  return `/customers/${customerId}/coverage-simulations`
}

export function CustomerCoverageSimulatorScopeLayout() {
  const { customerId } = useParams()
  const { user } = useAuth()
  const resolved = Number(customerId)
  const userKey = user?.id ?? 'guest'

  if (!Number.isInteger(resolved) || resolved <= 0) {
    return (
      <div className="coverage-simulator-root coverage-simulator-root--crm customer-coverage-simulations">
        <p className="customer-coverage-simulations__empty">고객을 선택해 주세요.</p>
      </div>
    )
  }

  const basePath = customerCoverageBasePath(resolved)

  return (
    <CoverageSimulatorScopeProvider
      basePath={basePath}
      userKey={userKey}
      layoutMode="crm"
      simulatorOrigin="customer"
      hideAlternativeViewSwitcher
    >
      <CoverageSimulatorCustomerProvider>
        <CoverageSimulatorCrmStorageProvider>
          <CoverageSimulatorToastProvider>
            <Outlet />
          </CoverageSimulatorToastProvider>
        </CoverageSimulatorCrmStorageProvider>
      </CoverageSimulatorCustomerProvider>
    </CoverageSimulatorScopeProvider>
  )
}

function CustomerCoverageSimulationsWorkspace() {
  const { customerId } = useParams()
  const { token } = useAuth()
  const resolved = Number(customerId)
  const [customerName, setCustomerName] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { basePath } = useCoverageSimulatorScope()

  const templateId = searchParams.get('templateId')
  const simulationId = searchParams.get('simulationId')

  useEffect(() => {
    if (!token?.trim() || !Number.isInteger(resolved) || resolved <= 0) {
      setCustomerName(null)
      return
    }
    void getCustomerById(token, resolved)
      .then((row) => setCustomerName(row.name))
      .catch(() => setCustomerName(null))
  }, [resolved, token])

  const onWorkspaceSelectionChange = useCallback(
    (selection: { templateId: string | null; simulationId: string | null }) => {
      const next = new URLSearchParams()
      if (selection.templateId) {
        next.set('templateId', selection.templateId)
      }
      if (selection.simulationId) {
        next.set('simulationId', selection.simulationId)
      }
      setSearchParams(next, { replace: true })
    },
    [setSearchParams],
  )

  const customerFilter = useMemo(
    () => ({
      customerId: String(resolved),
      customerName,
      readOnlyCustomerField: true,
    }),
    [customerName, resolved],
  )

  if (!Number.isInteger(resolved) || resolved <= 0) {
    return null
  }

  return (
    <div
      className="coverage-simulator-root coverage-simulator-root--crm customer-coverage-simulations customer-coverage-simulations--workspace"
      data-customer-coverage-base={basePath}
    >
      <CoverageThreePaneWorkspace
        density="compact"
        customerFilter={customerFilter}
        showAppBar={false}
        paneClassName="cs-three-pane--customer-embedded"
        simulationMenuMode="popover"
        initialTemplateId={templateId}
        initialSimulationId={simulationId}
        onWorkspaceSelectionChange={onWorkspaceSelectionChange}
      />
    </div>
  )
}

export default function CustomerCoverageSimulationsPage() {
  return <CustomerCoverageSimulationsWorkspace />
}
