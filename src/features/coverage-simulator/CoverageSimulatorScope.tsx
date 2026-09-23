import { createContext, useContext, type ReactNode } from 'react'

import { useAuth } from '../auth/AuthProvider'
import { COVERAGE_SIMULATOR_PREVIEW_USER_KEY } from './storage/scenarioRepository'

export type CoverageSimulatorScopeValue = {
  basePath: string
  userKey: string
  isPublicPreview: boolean
}

const CoverageSimulatorScopeContext = createContext<CoverageSimulatorScopeValue | null>(null)

export const COVERAGE_SIMULATOR_PREVIEW_BASE_PATH = '/coverage-simulator-preview'
const CRM_BASE_PATH = '/coverage-simulator'

export function CoverageSimulatorScopeProvider({
  basePath,
  userKey,
  isPublicPreview = false,
  children,
}: {
  basePath: string
  userKey: string
  isPublicPreview?: boolean
  children: ReactNode
}) {
  return (
    <CoverageSimulatorScopeContext.Provider value={{ basePath, userKey, isPublicPreview }}>
      {children}
    </CoverageSimulatorScopeContext.Provider>
  )
}

export function useCoverageSimulatorScope(): CoverageSimulatorScopeValue {
  const context = useContext(CoverageSimulatorScopeContext)
  const { user } = useAuth()
  if (context) {
    return context
  }
  return {
    basePath: CRM_BASE_PATH,
    userKey: user?.id ?? 'guest',
    isPublicPreview: false,
  }
}

/** Public preview shell — Provider + Outlet (라우터에서만 사용) */
export function useCoverageSimulatorPublicPreviewScope(): CoverageSimulatorScopeValue {
  return {
    basePath: COVERAGE_SIMULATOR_PREVIEW_BASE_PATH,
    userKey: COVERAGE_SIMULATOR_PREVIEW_USER_KEY,
    isPublicPreview: true,
  }
}

export function coverageSimulatorExitPath(basePath: string): string {
  if (basePath === COVERAGE_SIMULATOR_PREVIEW_BASE_PATH) {
    return COVERAGE_SIMULATOR_PREVIEW_BASE_PATH
  }
  return '/dashboard'
}
