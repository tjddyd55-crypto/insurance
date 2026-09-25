import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

import FormButton from '../../../components/form/FormButton'
import { ApiError } from '../../../lib/apiClient'
import { CenterAxisTimeline } from '../components/center-timeline/CenterAxisTimeline'
import { CoverageSimulatorLayout } from '../components/CoverageSimulatorLayout'
import {
  downloadPublicCoverageSharePdf,
  fetchPublicCoverageShare,
  type PublicCoverageSharePayload,
} from '../api/coverageSimulatorShareApi'
import { calculateScenarioTotals } from '../domain/totals'
import { resolveCustomerNameSnapshot } from '../domain/normalizeConsultation'
import { buildCoveragePdfFileName } from '../pdf/coveragePdfFileName'
import { CoverageSimulatorPrintDocument } from '../pdf/CoverageSimulatorPrintDocument'
import { buildCoveragePdfBlobFromPrintRoot } from '../pdf/generateCoveragePdf'
import { createRoot } from 'react-dom/client'
import type { CoverageScenario } from '../domain/types'
import '../styles/coverage-simulator.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; code: 'NOT_FOUND' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN'; message: string }
  | { status: 'ok'; payload: PublicCoverageSharePayload }

function formatSharedDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
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

function noop() {
  /* read-only */
}

export function CoverageSharePublicPage() {
  const { token = '' } = useParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [pdfBusy, setPdfBusy] = useState(false)

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
    setState({ status: 'loading' })
    void (async () => {
      try {
        const payload = await fetchPublicCoverageShare(token)
        if (cancelled) return
        setState({ status: 'ok', payload })
        document.title = `${payload.title} · 보장 시뮬레이션`
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
    }
  }, [token])

  const scenario = state.status === 'ok' ? state.payload.scenario : null
  const sortedItems = useMemo(() => {
    if (!scenario) return []
    return scenario.items.slice().sort((a, b) => a.order - b.order)
  }, [scenario])

  const totals = useMemo(() => {
    if (!scenario) return { currentTotal: 0, proposedTotal: 0 }
    return calculateScenarioTotals(scenario as CoverageScenario)
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
  const customerName = resolveCustomerNameSnapshot(payload.scenario)
  const sharedLabel = formatSharedDate(payload.sharedAt)
  const fileName = buildCoveragePdfFileName(payload.scenario)

  const downloadPdfFromSnapshot = async () => {
    const host = document.createElement('div')
    host.style.position = 'fixed'
    host.style.left = '-10000px'
    host.style.width = '794px'
    document.body.appendChild(host)
    const mount = document.createElement('div')
    host.appendChild(mount)
    const root = createRoot(mount)
    try {
      root.render(<CoverageSimulatorPrintDocument scenario={payload.scenario} />)
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
      await new Promise((resolve) => setTimeout(resolve, 50))
      const printRoot = mount.firstElementChild as HTMLElement | null
      if (!printRoot) throw new Error('PDF 렌더에 실패했습니다.')
      const blob = await buildCoveragePdfBlobFromPrintRoot(printRoot)
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(objectUrl)
    } finally {
      root.unmount()
      host.remove()
    }
  }

  const downloadPdf = async () => {
    setPdfBusy(true)
    try {
      await downloadPublicCoverageSharePdf(token, fileName)
    } catch (error) {
      const notReady =
        error instanceof Error &&
        (error.message.includes('준비되지 않') || error.message.includes('PDF_NOT_READY'))
      if (notReady) {
        try {
          await downloadPdfFromSnapshot()
          return
        } catch {
          window.alert('PDF를 다운로드하지 못했습니다.')
          return
        }
      }
      const message = error instanceof Error ? error.message : 'PDF를 다운로드하지 못했습니다.'
      window.alert(message)
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <CoverageSimulatorLayout shellClassName="cs-share-public-shell">
      <header className="cs-share-public__header">
        <h1 className="cs-share-public__title">{payload.title}</h1>
        {customerName ? <p className="cs-share-public__customer">{customerName} 고객님</p> : null}
        {sharedLabel ? <p className="cs-share-public__date">공유일 {sharedLabel}</p> : null}
        <FormButton
          variant="primary"
          className="coverage-simulator-primary-btn cs-share-public__pdf-btn"
          disabled={pdfBusy}
          onClick={() => void downloadPdf()}
        >
          {pdfBusy ? 'PDF 준비 중…' : 'PDF 다운로드'}
        </FormButton>
      </header>
      <main className="cs-share-public">
        <CenterAxisTimeline
          readOnly
          items={sortedItems}
          currentTotal={totals.currentTotal}
          proposedTotal={totals.proposedTotal}
          variant="mobile"
          showInlineSummary
          compactInsert
          itemMenuMode="action-sheet"
          onEditItem={noop}
          onMoveItem={noop}
          onRemoveItem={noop}
          onAddAfter={noop}
        />
      </main>
      <footer className="cs-share-public__footer">
        <FormButton
          variant="primary"
          className="coverage-simulator-primary-btn cs-share-public__pdf-btn"
          disabled={pdfBusy}
          onClick={() => void downloadPdf()}
        >
          {pdfBusy ? 'PDF 준비 중…' : 'PDF 다운로드'}
        </FormButton>
      </footer>
    </CoverageSimulatorLayout>
  )
}
