import { createContext, useContext, type ReactNode } from 'react'

type CoverageThreePaneEditorNavigationValue = {
  onBackFromEditor?: () => void
  hideEditorBack?: boolean
  /** 고객 embed PDF 닫기 시 복귀 URL (pathname + search) */
  customerPdfReturnTo?: string | null
}

const CoverageThreePaneEditorNavigationContext =
  createContext<CoverageThreePaneEditorNavigationValue | null>(null)

export function CoverageThreePaneEditorNavigationProvider({
  value,
  children,
}: {
  value: CoverageThreePaneEditorNavigationValue
  children: ReactNode
}) {
  return (
    <CoverageThreePaneEditorNavigationContext.Provider value={value}>
      {children}
    </CoverageThreePaneEditorNavigationContext.Provider>
  )
}

export function useCoverageThreePaneEditorNavigation(): CoverageThreePaneEditorNavigationValue {
  return useContext(CoverageThreePaneEditorNavigationContext) ?? {}
}
