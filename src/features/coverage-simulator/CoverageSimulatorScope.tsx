import { createContext, useContext, type ReactNode } from 'react'

import { useAuth } from '../auth/AuthProvider'
import {
  COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY,
  COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY,
} from './storage/scenarioRepository'

export type CoverageSimulatorLayoutMode = 'crm' | 'preview-pc' | 'preview-mobile'

export type CoverageSimulatorScopeValue = {
  basePath: string
  userKey: string
  isPublicPreview: boolean
  layoutMode: CoverageSimulatorLayoutMode
}

const CoverageSimulatorScopeContext = createContext<CoverageSimulatorScopeValue | null>(null)

export const COVERAGE_SIMULATOR_PREVIEW_PC_BASE_PATH = '/coverage-simulator-preview/pc'
export const COVERAGE_SIMULATOR_PREVIEW_MOBILE_BASE_PATH = '/coverage-simulator-preview/mobile'
const CRM_BASE_PATH = '/coverage-simulator'

export function CoverageSimulatorScopeProvider({
  basePath,
  userKey,
  isPublicPreview = false,
  layoutMode = 'crm',
  children,
}: {
  basePath: string
  userKey: string
  isPublicPreview?: boolean
  layoutMode?: CoverageSimulatorLayoutMode
  children: ReactNode
}) {
  return (
    <CoverageSimulatorScopeContext.Provider value={{ basePath, userKey, isPublicPreview, layoutMode }}>
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
    layoutMode: 'crm',
  }
}

export function coverageSimulatorExitPath(basePath: string): string {
  if (basePath === COVERAGE_SIMULATOR_PREVIEW_PC_BASE_PATH) {
    return COVERAGE_SIMULATOR_PREVIEW_PC_BASE_PATH
  }
  if (basePath === COVERAGE_SIMULATOR_PREVIEW_MOBILE_BASE_PATH) {
    return COVERAGE_SIMULATOR_PREVIEW_MOBILE_BASE_PATH
  }
  return '/dashboard'
}

export const previewScopePc = {
  basePath: COVERAGE_SIMULATOR_PREVIEW_PC_BASE_PATH,
  userKey: COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY,
  isPublicPreview: true,
  layoutMode: 'preview-pc' as const,
}

export const previewScopeMobile = {
  basePath: COVERAGE_SIMULATOR_PREVIEW_MOBILE_BASE_PATH,
  userKey: COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY,
  isPublicPreview: true,
  layoutMode: 'preview-mobile' as const,
}
