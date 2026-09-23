import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import { CoverageSimulatorPrintDocument } from '../pdf/CoverageSimulatorPrintDocument'
import { downloadCoveragePdfFromPrintRoot, printCoverageDocument } from '../pdf/generateCoveragePdf'
import { getScenarioById } from '../storage/scenarioRepository'

export function PdfPreviewPage() {
  const { scenarioId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userKey = user?.id ?? 'guest'
  const printRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)

  const scenario = getScenarioById(userKey, scenarioId)

  useEffect(() => {
    if (!scenario) return
    document.title = `보장 시뮬레이션 PDF · ${scenario.title}`
  }, [scenario])

  if (!scenario) {
    return (
      <CoverageSimulatorLayout>
        <main className="coverage-simulator-content">저장된 시나리오를 찾을 수 없습니다.</main>
      </CoverageSimulatorLayout>
    )
  }

  const fileName = `coverage-simulator-${scenario.title.replace(/\s+/g, '-')}.pdf`

  return (
    <CoverageSimulatorLayout>
      <header className="coverage-simulator-appbar">
        <button
          type="button"
          className="coverage-simulator-icon-btn"
          onClick={() => navigate(`/coverage-simulator/scenarios/${scenario.id}`)}
        >
          ←
        </button>
        <div className="coverage-simulator-appbar__title">PDF 미리보기</div>
        <span />
      </header>
      <main className="coverage-simulator-content" style={{ paddingBottom: 120 }}>
        <div style={{ overflowX: 'auto' }}>
          <div ref={printRef}>
            <CoverageSimulatorPrintDocument scenario={scenario} />
          </div>
        </div>
      </main>
      <footer className="coverage-simulator-bottom-bar" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <button type="button" className="coverage-simulator-secondary-btn" onClick={() => printCoverageDocument()}>
          인쇄
        </button>
        <button
          type="button"
          className="coverage-simulator-secondary-btn"
          disabled={busy}
          onClick={async () => {
            if (!printRef.current?.firstElementChild) return
            setBusy(true)
            try {
              await downloadCoveragePdfFromPrintRoot(
                printRef.current.firstElementChild as HTMLElement,
                fileName,
              )
            } finally {
              setBusy(false)
            }
          }}
        >
          PDF 저장
        </button>
        <button
          type="button"
          className="coverage-simulator-primary-btn"
          onClick={async () => {
            if (!printRef.current?.firstElementChild) return
            setBusy(true)
            try {
              await downloadCoveragePdfFromPrintRoot(
                printRef.current.firstElementChild as HTMLElement,
                fileName,
              )
              if (navigator.share) {
                await navigator.share({ title: scenario.title, text: '보장 시뮬레이션 PDF' })
              }
            } catch {
              /* user cancelled share */
            } finally {
              setBusy(false)
            }
          }}
        >
          공유
        </button>
      </footer>
    </CoverageSimulatorLayout>
  )
}
