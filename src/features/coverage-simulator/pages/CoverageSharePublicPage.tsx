import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import FormButton from '../../../components/form/FormButton'
import { ApiError } from '../../../lib/apiClient'
import { CoverageScenarioTimeline } from '../components/center-timeline/CoverageScenarioTimeline'
import { MobilePreviewStickyDock } from '../components/MobilePreviewStickyDock'
import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import {
  fetchPublicCoverageShare,
  publicCoverageSharePdfDownloadUrl,
  type PublicCoverageSharePayload,
} from '../api/coverageSimulatorShareApi'
import { CoverageSimulatorScopeProvider, previewScopeMobile } from '../CoverageSimulatorScope'
import { buildCoverageTimelineViewModel } from '../domain/buildCoverageTimelineViewModel'
import { formatCoverageScenarioHeading } from '../domain/diseaseTypeLabels'
import { resolveCustomerNameSnapshot } from '../domain/normalizeConsultation'
import type { CoverageScenario } from '../domain/types'
import { buildCoveragePdfFileName } from '../pdf/coveragePdfFileName'
import { CoverageSimulatorPrintDocument } from '../pdf/CoverageSimulatorPrintDocument'
import {
  buildCoveragePdfBlobFromPrintRoot,
  downloadCoveragePdfBlob,
} from '../pdf/generateCoveragePdf'
import '../styles/coverage-simulator.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; code: 'NOT_FOUND' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN'; message: string }
  | { status: 'ok'; payload: PublicCoverageSharePayload }

function formatConsultationDate(iso: string | undefined): string {
  const raw = (iso ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return ''
  const [year, month, day] = raw.split('-')
  return `${year}.${month}.${day}`
}

function ShareStatusScreen({ title, message }: { title: string; message: string }) {
  return (
    <CoverageSimulatorLayout shellClassName="cs-share-public-shell">
      <main className="cs-share-public cs-share-public--status">
        <h1 className="cs-share-public__status-title">{title}</h1>
        <p className="cs-share-public__status-message">{message}</p>
      </main>
    </CoverageSimulatorLayout>
  )
}

function CoverageSharePublicPageBody() {
  const { token = '' } = useParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [pdfBusy, setPdfBusy] = useState(false)
  const printSourceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => {
      meta.remove()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadingFrame = requestAnimationFrame(() => {
      if (!cancelled) setState({ status: 'loading' })
    })
    void (async () => {
      try {
        const payload = await fetchPublicCoverageShare(token)
        if (cancelled) return
        setState({ status: 'ok', payload })
        const customerName = resolveCustomerNameSnapshot(payload.scenario)
        document.title = customerName
          ? `${customerName}님 보장 시뮬레이션`
          : '보장 시뮬레이션'
      } catch (error) {
        if (cancelled) return
        const status = error instanceof ApiError ? error.status : 0
        const code = error instanceof ApiError ? error.code ?? '' : ''
        if (status === 410 && code === 'REVOKED') {
          setState({ status: 'error', code: 'REVOKED', message: '공유가 중지된 자료입니다.' })
          return
        }
        if (status === 410 && code === 'EXPIRED') {
          setState({ status: 'error', code: 'EXPIRED', message: '공유 기간이 만료된 자료입니다.' })
          return
        }
        setState({
          status: 'error',
          code: 'NOT_FOUND',
          message: '공유 자료를 찾을 수 없습니다.',
        })
      }
    })()
    return () => {
      cancelled = true
      cancelAnimationFrame(loadingFrame)
    }
  }, [token])

  const scenario = state.status === 'ok' ? state.payload.scenario : null
  const viewModel = useMemo(() => {
    if (!scenario) return null
    return buildCoverageTimelineViewModel(scenario as CoverageScenario, { compactInsert: true })
  }, [scenario])

  if (state.status === 'loading') {
    return (
      <CoverageSimulatorLayout shellClassName="cs-share-public-shell">
        <main className="cs-share-public cs-share-public--status">
          <p className="cs-share-public__status-message">상담 자료를 불러오는 중…</p>
        </main>
      </CoverageSimulatorLayout>
    )
  }

  if (state.status === 'error') {
    const title =
      state.code === 'REVOKED'
        ? '공유 중지'
        : state.code === 'EXPIRED'
          ? '만료됨'
          : '자료 없음'
    return <ShareStatusScreen title={title} message={state.message} />
  }

  const payload = state.payload
  const shareScenario = payload.scenario as CoverageScenario
  const customerName = resolveCustomerNameSnapshot(shareScenario)
  const wroteLabel = formatConsultationDate(shareScenario.consultationDate)
  const scenarioHeading = formatCoverageScenarioHeading(shareScenario.diseaseType, shareScenario.title)
  const downloadStoredPdf = () => {
    window.location.assign(publicCoverageSharePdfDownloadUrl(token))
  }
  const downloadGeneratedPdf = async () => {
    const printRoot = printSourceRef.current?.querySelector('.coverage-simulator-print-root')
    if (!(printRoot instanceof HTMLElement)) {
      window.alert('PDF를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    setPdfBusy(true)
    try {
      const blob = await buildCoveragePdfBlobFromPrintRoot(printRoot)
      downloadCoveragePdfBlob(blob, buildCoveragePdfFileName(shareScenario))
    } catch (error) {
      console.error('[coverage-share] on-demand PDF failed', error)
      window.alert('PDF를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setPdfBusy(false)
    }
  }
  const downloadPdf = () => {
    if (payload.pdfReady) {
      downloadStoredPdf()
      return
    }
    void downloadGeneratedPdf()
  }

  return (
    <CoverageSimulatorLayout shellClassName="cs-share-public-shell">
      <header className="cs-share-public__header">
        <h1 className="cs-share-public__title">보장 시뮬레이션</h1>
        <p className="cs-share-public__scenario">{scenarioHeading}</p>
        {customerName || wroteLabel ? (
          <p className="cs-share-public__meta">
            {customerName ? <span>고객: {customerName}</span> : null}
            {wroteLabel ? <span>작성일 {wroteLabel}</span> : null}
          </p>
        ) : null}
        <FormButton
          variant="primary"
          className="coverage-simulator-primary-btn cs-share-public__pdf-btn"
          disabled={pdfBusy}
          onClick={downloadPdf}
        >
          {pdfBusy ? 'PDF 만드는 중…' : 'PDF 다운로드'}
        </FormButton>
      </header>
      <main className="cs-share-public cs-share-public--with-dock">
        {viewModel ? (
          <CoverageScenarioTimeline mode="readonly" viewModel={viewModel} variant="mobile" showGrandTotal={false} />
        ) : null}
      </main>
      {viewModel ? (
        <MobilePreviewStickyDock
          currentTotal={viewModel.totals.currentTotal}
          proposedTotal={viewModel.totals.proposedTotal}
        />
      ) : null}
      <div
        ref={printSourceRef}
        className="coverage-simulator-pdf-print-source"
        data-testid="coverage-share-pdf-print-source"
        aria-hidden="true"
      >
        <CoverageSimulatorPrintDocument scenario={shareScenario} />
      </div>
    </CoverageSimulatorLayout>
  )
}

export function CoverageSharePublicPage() {
  return (
    <CoverageSimulatorScopeProvider {...previewScopeMobile}>
      <CoverageSharePublicPageBody />
    </CoverageSimulatorScopeProvider>
  )
}
