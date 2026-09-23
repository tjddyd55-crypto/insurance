import { Outlet } from 'react-router-dom'

import {
  COVERAGE_SIMULATOR_PREVIEW_BASE_PATH,
  CoverageSimulatorScopeProvider,
} from '../CoverageSimulatorScope'
import { COVERAGE_SIMULATOR_PREVIEW_USER_KEY } from '../storage/scenarioRepository'
import '../styles/coverage-simulator.css'

/**
 * CRM AppWorkspaceLayout·인증과 완전 분리된 공개 보장 시뮬레이션 Shell.
 * `/introduction`과 동일 Public Route Layer에만 등록한다.
 */
export function CoverageSimulatorPublicLayout() {
  return (
    <CoverageSimulatorScopeProvider
      basePath={COVERAGE_SIMULATOR_PREVIEW_BASE_PATH}
      userKey={COVERAGE_SIMULATOR_PREVIEW_USER_KEY}
      isPublicPreview
    >
      <div className="coverage-simulator-public-root" data-testid="coverage-simulator-public-root">
        <p className="coverage-simulator-public-chrome" aria-hidden="true">
          <span className="coverage-simulator-public-chrome__badge">PREVIEW</span>
          보장 시뮬레이션
        </p>
        <Outlet />
      </div>
    </CoverageSimulatorScopeProvider>
  )
}

/** 라우터 호환 alias */
export const CoverageSimulatorPreviewLayout = CoverageSimulatorPublicLayout
