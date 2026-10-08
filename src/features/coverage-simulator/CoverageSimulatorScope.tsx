import { createContext, useContext, type ReactNode } from 'react'

import { useAuth } from '../auth/AuthProvider'
import {
  COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY,
  COVERAGE_SIMULATOR_PREVIEW_PC_USER_KEY,
} from './storage/scenarioRepository'

export type CoverageSimulatorLayoutMode = 'crm' | 'preview-pc' | 'preview-mobile'

export type CoverageSimulatorOrigin = 'main' | 'customer'

export type CoverageSimulatorScopeValue = {
  basePath: string
  userKey: string
  isPublicPreview: boolean
  layoutMode: CoverageSimulatorLayoutMode
  /** 메인 보장 시뮬레이션 vs 고객 작업영역 */
  simulatorOrigin: CoverageSimulatorOrigin
  /** 고객 화면에서는 1안/2안/3안 선택 UI를 숨기고 기본 보기만 사용 */
  hideAlternativeViewSwitcher: boolean
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
  simulatorOrigin = 'main',
  hideAlternativeViewSwitcher = false,
  children,
}: {
  basePath: string
  userKey: string
  isPublicPreview?: boolean
  layoutMode?: CoverageSimulatorLayoutMode
  simulatorOrigin?: CoverageSimulatorOrigin
  hideAlternativeViewSwitcher?: boolean
  children: ReactNode
}) {
  return (
    <CoverageSimulatorScopeContext.Provider
      value={{
        basePath,
        userKey,
        isPublicPreview,
        layoutMode,
        simulatorOrigin,
        hideAlternativeViewSwitcher,
      }}
    >
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
    simulatorOrigin: 'main',
    hideAlternativeViewSwitcher: false,
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
  simulatorOrigin: 'main' as const,
  hideAlternativeViewSwitcher: false,
}

export const previewScopeMobile = {
  basePath: COVERAGE_SIMULATOR_PREVIEW_MOBILE_BASE_PATH,
  userKey: COVERAGE_SIMULATOR_PREVIEW_MOBILE_USER_KEY,
  isPublicPreview: true,
  layoutMode: 'preview-mobile' as const,
  simulatorOrigin: 'main' as const,
  hideAlternativeViewSwitcher: false,
}
