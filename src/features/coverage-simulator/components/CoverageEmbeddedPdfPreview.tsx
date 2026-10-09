import { useEffect, useRef, useState } from 'react'

import FormButton from '../../../components/form/FormButton'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { useCoverageSimulatorToast } from './CoverageSimulatorToast'
import { CoveragePdfPreviewZoomSurface } from './CoveragePdfPreviewZoomSurface'
import { buildCoveragePdfFileName } from '../pdf/coveragePdfFileName'
import { CoverageSimulatorPrintDocument } from '../pdf/CoverageSimulatorPrintDocument'
import { buildCoveragePdfBlobFromPrintRoot, downloadCoveragePdfBlob } from '../pdf/generateCoveragePdf'
import { getScenarioById } from '../storage/scenarioRepository'

type Props = {
  scenarioId: string
  onClose: () => void
}

export function CoverageEmbeddedPdfPreview({ scenarioId, onClose }: Props) {
  const { userKey, simulatorOrigin } = useCoverageSimulatorScope()
  const { showToast } = useCoverageSimulatorToast()
  const printSourceRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)

  const scenario = getScenarioById(userKey, scenarioId)

  useEffect(() => {
    if (!scenario) return
    document.title = `보장 시뮬레이션 PDF · ${scenario.title}`
  }, [scenario])

  if (!scenario) {
    return (
      <div className="coverage-embedded-pdf-preview coverage-embedded-pdf-preview--empty">
        <p>저장된 시뮬레이션을 찾을 수 없습니다.</p>
        <FormButton variant="secondary" onClick={onClose}>닫기</FormButton>
      </div>
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
    <div
      className={[
        'coverage-embedded-pdf-preview',
        simulatorOrigin === 'customer' ? 'coverage-embedded-pdf-preview--customer' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="coverage-embedded-pdf-preview__header">
        <div className="coverage-embedded-pdf-preview__title">
          <strong>PDF 미리보기</strong>
          <span>{scenario.title}</span>
        </div>
        <FormButton variant="secondary" size="sm" onClick={onClose}>닫기</FormButton>
      </header>
      <div className="coverage-embedded-pdf-preview__viewport">
        <CoveragePdfPreviewZoomSurface key={scenario.id} documentKey={scenario.id}>
          <CoverageSimulatorPrintDocument scenario={scenario} />
        </CoveragePdfPreviewZoomSurface>
      </div>
      <footer className="coverage-embedded-pdf-preview__footer">
        <FormButton
          variant="secondary"
          className="coverage-simulator-secondary-btn"
          disabled={busy}
          onClick={() => void downloadPdf()}
        >
          {busy ? '만드는 중…' : 'PDF 저장'}
        </FormButton>
      </footer>
      <div
        ref={printSourceRef}
        className="coverage-simulator-pdf-print-source"
        data-testid="coverage-pdf-print-source"
        aria-hidden="true"
      >
        <CoverageSimulatorPrintDocument scenario={scenario} />
      </div>
    </div>
  )
}
