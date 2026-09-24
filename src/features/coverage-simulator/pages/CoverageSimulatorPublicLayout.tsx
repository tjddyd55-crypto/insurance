import { Outlet } from 'react-router-dom'

import {
  CoverageSimulatorScopeProvider,
  previewScopeMobile,
  previewScopePc,
} from '../CoverageSimulatorScope'
import '../styles/coverage-simulator.css'

function PreviewChrome({ label }: { label: string }) {
  return (
    <p className="coverage-simulator-public-chrome" data-coverage-simulator-preview-chrome="true">
      <span className="coverage-simulator-public-chrome__badge">PREVIEW</span>
      {label}
    </p>
  )
}

export function CoverageSimulatorPublicPcLayout() {
  return (
    <CoverageSimulatorScopeProvider {...previewScopePc}>
      <div className="coverage-simulator-pc-preview-root" data-testid="coverage-simulator-public-pc-root">
        <PreviewChrome label="보장 시뮬레이션 · PC" />
        <Outlet />
      </div>
    </CoverageSimulatorScopeProvider>
  )
}

export function CoverageSimulatorPublicMobileLayout() {
  return (
    <CoverageSimulatorScopeProvider {...previewScopeMobile}>
      <div
        className="coverage-simulator-mobile-preview-root"
        data-testid="coverage-simulator-public-mobile-root"
        data-coverage-simulator-preview="mobile"
      >
        <div className="coverage-simulator-mobile-preview-frame">
          <Outlet />
        </div>
      </div>
    </CoverageSimulatorScopeProvider>
  )
}
