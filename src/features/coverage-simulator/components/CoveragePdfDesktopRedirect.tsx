import { useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'

/** PC 3열 workspace — /scenarios/:id/pdf 직접 접근 시 workspace로 복귀 후 pane PDF 오픈 */
export function CoveragePdfDesktopRedirect() {
  const { scenarioId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { basePath } = useCoverageSimulatorScope()

  useEffect(() => {
    if (!scenarioId) return
    navigate(
      { pathname: basePath, search: location.search },
      {
        replace: true,
        state: { openPdfScenarioId: scenarioId },
      },
    )
  }, [basePath, location.search, navigate, scenarioId])

  return null
}
