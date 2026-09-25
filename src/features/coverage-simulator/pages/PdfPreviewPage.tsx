import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../../auth/AuthProvider'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { CoveragePdfPreviewZoomSurface } from '../components/CoveragePdfPreviewZoomSurface'
import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import { CoverageSimulatorToastProvider, useCoverageSimulatorToast } from '../components/CoverageSimulatorToast'
import FormButton from '../../../components/form/FormButton'
import { buildCoveragePdfFileName } from '../pdf/coveragePdfFileName'
import { CoverageSimulatorPrintDocument } from '../pdf/CoverageSimulatorPrintDocument'
import { buildCoveragePdfBlobFromPrintRoot } from '../pdf/generateCoveragePdf'
import { resolveCoverageShareProviderMode } from '../share/coverageShareProviderMode'
import { createCoverageShareProvider } from '../share/createCoverageShareProvider'
import { getScenarioById } from '../storage/scenarioRepository'

function PdfPreviewPageBody() {
  const { scenarioId = '' } = useParams()
  const navigate = useNavigate()
  const { basePath, userKey, layoutMode } = useCoverageSimulatorScope()
  const { token } = useAuth()
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
  const provider = createCoverageShareProvider(
    resolveCoverageShareProviderMode(layoutMode),
    token,
  )

  const savePdf = async () => {
    const printRoot = printSourceRef.current?.querySelector('.coverage-simulator-print-root') as HTMLElement | null
    if (!printRoot || !provider) {
      showToast('PDF 저장을 위해 로그인이 필요합니다.')
      return
    }
    setBusy(true)
    try {
      const accessible = await provider.ensureAccess()
      if (!accessible) {
        showToast('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.')
        return
      }
      const pdfBlob = await buildCoveragePdfBlobFromPrintRoot(printRoot)
      const artifact = await provider.createPdfArtifact(pdfBlob, fileName)
      window.location.assign(artifact.downloadUrl)
    } catch {
      showToast('PDF를 저장하지 못했습니다. 다시 시도해 주세요.')
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
          <CoveragePdfPreviewZoomSurface key={scenario.id} documentKey={scenario.id}>
            <CoverageSimulatorPrintDocument scenario={scenario} />
          </CoveragePdfPreviewZoomSurface>
        </div>
      </main>
      <div ref={printSourceRef} className="coverage-simulator-pdf-print-source" aria-hidden="true">
        <CoverageSimulatorPrintDocument scenario={scenario} />
      </div>
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

export function PdfPreviewPage() {
  return (
    <CoverageSimulatorToastProvider>
      <PdfPreviewPageBody />
    </CoverageSimulatorToastProvider>
  )
}
