import { Outlet } from 'react-router-dom'

import { CoverageSimulatorCustomerProvider } from '../context/CoverageSimulatorCustomerContext'

/** CRM `/coverage-simulator/*` — Preview와 동일하게 단일 CustomerProvider instance */
export function CoverageSimulatorCrmRouteLayout() {
  return (
    <CoverageSimulatorCustomerProvider>
      <Outlet />
    </CoverageSimulatorCustomerProvider>
  )
}
