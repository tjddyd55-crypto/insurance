import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import FormButton from '../../../components/form/FormButton'
import { buildCoveragePdfFileName } from '../pdf/coveragePdfFileName'
import { CoverageSimulatorPrintDocument } from '../pdf/CoverageSimulatorPrintDocument'
import { downloadCoveragePdfFromPrintRoot } from '../pdf/generateCoveragePdf'
import { getScenarioById } from '../storage/scenarioRepository'

export function PdfPreviewPage() {
  const { scenarioId = '' } = useParams()
  const navigate = useNavigate()
  const { basePath, userKey } = useCoverageSimulatorScope()
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

  const fileName = buildCoveragePdfFileName(scenario)

  const savePdf = async () => {
    if (!printRef.current?.firstElementChild) return
    setBusy(true)
    try {
      await downloadCoveragePdfFromPrintRoot(printRef.current.firstElementChild as HTMLElement, fileName)
    } finally {
      setBusy(false)
    }
  }

  return (
    <CoverageSimulatorLayout>
      <header className="coverage-simulator-appbar">
        <FormButton
          variant="action"
          className="coverage-simulator-icon-btn"
          onClick={() => navigate(`${basePath}/scenarios/${scenario.id}`)}
        >
          ←
        </FormButton>
        <div className="coverage-simulator-appbar__title">PDF 미리보기</div>
        <span />
      </header>
      <main className="coverage-simulator-content coverage-simulator-pdf-preview" style={{ paddingBottom: 96 }}>
        <div className="coverage-simulator-pdf-preview__scroll">
          <div ref={printRef} className="coverage-simulator-pdf-preview__page">
            <CoverageSimulatorPrintDocument scenario={scenario} />
          </div>
        </div>
      </main>
      <footer className="coverage-simulator-bottom-bar" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <FormButton variant="secondary" className="coverage-simulator-secondary-btn" disabled={busy} onClick={savePdf}>
          PDF 저장
        </FormButton>
        <FormButton
          variant="primary"
          className="coverage-simulator-primary-btn"
          onClick={() => navigate(`${basePath}/scenarios/${scenario.id}`)}
        >
          닫기
        </FormButton>
      </footer>
    </CoverageSimulatorLayout>
  )
}
