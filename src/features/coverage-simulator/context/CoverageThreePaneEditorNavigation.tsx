import { createContext, useContext, type ReactNode } from 'react'

type CoverageThreePaneEditorNavigationValue = {
  onBackFromEditor?: () => void
  hideEditorBack?: boolean
  /** PC 3열 오른쪽 pane에서 PDF 미리보기 */
  openPdfInPane?: (scenarioId: string) => void
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
