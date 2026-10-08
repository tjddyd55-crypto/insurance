import { CoverageSimulatorToastProvider } from '../components/CoverageSimulatorToast'
import { CoverageThreePaneWorkspace } from '../components/CoverageThreePaneWorkspace'

export function CoverageThreePaneWorkspacePage() {
  return (
    <CoverageSimulatorToastProvider>
      <CoverageThreePaneWorkspace density="default" showAppBar />
    </CoverageSimulatorToastProvider>
  )
}
