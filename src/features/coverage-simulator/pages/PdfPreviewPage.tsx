import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'

type PdfPreviewLocationState = {
  returnTo?: string
}
import { CoveragePdfPreviewZoomSurface } from '../components/CoveragePdfPreviewZoomSurface'
import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import { CoverageSimulatorToastProvider, useCoverageSimulatorToast } from '../components/CoverageSimulatorToast'
import FormButton from '../../../components/form/FormButton'
import { buildCoveragePdfFileName } from '../pdf/coveragePdfFileName'
import { CoverageSimulatorPrintDocument } from '../pdf/CoverageSimulatorPrintDocument'
import { buildCoveragePdfBlobFromPrintRoot, downloadCoveragePdfBlob } from '../pdf/generateCoveragePdf'
import { getScenarioById } from '../storage/scenarioRepository'

function PdfPreviewPageBody() {
  const { scenarioId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { basePath, userKey, simulatorOrigin } = useCoverageSimulatorScope()
  const returnTo = (location.state as PdfPreviewLocationState | null)?.returnTo
  const printSourceRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const { showToast } = useCoverageSimulatorToast()

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

  const readPrintRoot = () =>
    printSourceRef.current?.querySelector('.coverage-simulator-print-root') as HTMLElement | null

  const downloadPdf = async () => {
    const printRoot = readPrintRoot()
    if (!printRoot) {
      showToast('PDF를 만들지 못했습니다. 다시 시도해 주세요.')
      return
    }
    setBusy(true)
    try {
      const pdfBlob = await buildCoveragePdfBlobFromPrintRoot(printRoot)
      downloadCoveragePdfBlob(pdfBlob, fileName)
    } catch (error) {
      console.error('[coverage-pdf] PDF download failed', error)
      showToast('PDF를 만들지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <CoverageSimulatorLayout
      shellClassName={[
        'coverage-simulator-pdf-preview-shell',
        simulatorOrigin === 'customer' ? 'coverage-simulator-pdf-preview-shell--customer-embed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <main className="coverage-simulator-content coverage-simulator-pdf-preview">
        <CoveragePdfPreviewZoomSurface key={scenario.id} documentKey={scenario.id}>
          <CoverageSimulatorPrintDocument scenario={scenario} />
        </CoveragePdfPreviewZoomSurface>
      </main>
      <div
        ref={printSourceRef}
        className="coverage-simulator-pdf-print-source"
        data-testid="coverage-pdf-print-source"
        aria-hidden="true"
      >
        <CoverageSimulatorPrintDocument scenario={scenario} />
      </div>
      <footer className="coverage-simulator-bottom-bar" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <FormButton
          variant="secondary"
          className="coverage-simulator-secondary-btn"
          disabled={busy}
          onClick={() => void downloadPdf()}
        >
          {busy ? '만드는 중…' : 'PDF 저장'}
        </FormButton>
        <FormButton
          variant="primary"
          className="coverage-simulator-primary-btn"
          onClick={() => {
            if (returnTo) {
              navigate(returnTo)
              return
            }
            if (simulatorOrigin === 'customer') {
              navigate(basePath)
              return
            }
            navigate(`${basePath}/scenarios/${scenario.id}`)
          }}
        >
          닫기
        </FormButton>
      </footer>
    </CoverageSimulatorLayout>
  )
}

export function PdfPreviewPage() {
  return (
    <CoverageSimulatorToastProvider>
      <PdfPreviewPageBody />
    </CoverageSimulatorToastProvider>
  )
}
