import { useCallback, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { useAuth } from '../../auth/AuthProvider'
import {
  createCoverageSimulationShare,
  uploadCoverageSharePdf,
  type CreateCoverageShareResponse,
} from '../api/coverageSimulatorShareApi'
import { buildCoverageShareWebSharePayload } from '../domain/coverageShareCopy'
import { normalizeConsultation } from '../domain/normalizeConsultation'
import type { CoverageScenario } from '../domain/types'
import { canUseWebShare, copyTextToClipboard } from '../lib/clipboard'
import { buildCoveragePdfFileName } from '../pdf/coveragePdfFileName'
import { CoverageSimulatorPrintDocument } from '../pdf/CoverageSimulatorPrintDocument'
import { buildCoveragePdfBlobFromPrintRoot } from '../pdf/generateCoveragePdf'
import type { SaveConsultationResult } from './useScenarioEditor'

type ConfirmFn = (options: {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
}) => Promise<boolean>

type Params = {
  scenario: CoverageScenario | null
  isDirty: () => boolean
  requestSaveConsultation: (title?: string) => Promise<SaveConsultationResult>
  showToast: (message: string) => void
  confirm: ConfirmFn
}

async function buildSharePdfBlob(scenario: CoverageScenario): Promise<Blob> {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = '794px'
  host.style.background = '#fff'
  document.body.appendChild(host)
  const mount = document.createElement('div')
  host.appendChild(mount)
  let root: Root | null = null
  try {
    root = createRoot(mount)
    root.render(<CoverageSimulatorPrintDocument scenario={scenario} />)
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
    await new Promise((resolve) => setTimeout(resolve, 50))
    const printRoot = mount.firstElementChild as HTMLElement | null
    if (!printRoot) {
      throw new Error('PDF 렌더 루트를 찾을 수 없습니다.')
    }
    return await buildCoveragePdfBlobFromPrintRoot(printRoot)
  } finally {
    root?.unmount()
    host.remove()
  }
}

export function useCoverageShareFlow({ scenario, isDirty, requestSaveConsultation, showToast, confirm }: Params) {
  const { token } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [phase, setPhase] = useState<'confirm' | 'result'>('confirm')
  const [sharing, setSharing] = useState(false)
  const [shareResult, setShareResult] = useState<CreateCoverageShareResponse | null>(null)
  const shareBusyRef = useRef(false)

  const canShare = Boolean(token && scenario)

  const ensureSaved = useCallback(async (): Promise<CoverageScenario | null> => {
    if (!scenario) return null
    if (!isDirty()) return normalizeConsultation(scenario)
    const ok = await confirm({
      title: '변경사항을 먼저 저장한 후 공유할까요?',
      message: '공유 링크에는 저장된 상담 내용이 반영됩니다.',
      confirmLabel: '저장 후 공유',
      cancelLabel: '취소',
    })
    if (!ok) return null
    const saveResult = await requestSaveConsultation()
    if ('needsTitle' in saveResult && saveResult.needsTitle) {
      showToast(saveResult.validationError ?? '제목을 입력한 후 저장해 주세요.')
      return null
    }
    if (!saveResult.ok) {
      showToast(saveResult.toast)
      return null
    }
    return normalizeConsultation(scenario)
  }, [confirm, isDirty, requestSaveConsultation, scenario, showToast])

  const openShareDialog = useCallback(async () => {
    if (!token) {
      showToast('로그인이 필요합니다.')
      return
    }
    if (!scenario) return
    const saved = await ensureSaved()
    if (!saved) return
    setShareResult(null)
    setPhase('confirm')
    setDialogOpen(true)
  }, [ensureSaved, scenario, showToast, token])

  const uploadPdfInBackground = useCallback(
    async (shareId: string, snapshot: CoverageScenario) => {
      if (!token) return
      try {
        const blob = await buildSharePdfBlob(snapshot)
        await uploadCoverageSharePdf(token, shareId, blob)
      } catch {
        // Viewer는 snapshot 기반; PDF는 나중에 재시도 가능
      }
    },
    [token],
  )

  const createShare = useCallback(async () => {
    if (!token || !scenario || shareBusyRef.current) return
    const snapshot = normalizeConsultation(scenario)
    shareBusyRef.current = true
    setSharing(true)
    try {
      const created = await createCoverageSimulationShare(token, snapshot.id, snapshot)
      setShareResult(created)
      setPhase('result')
      void uploadPdfInBackground(created.shareId, snapshot)
    } catch (error) {
      const message = error instanceof Error ? error.message : '공유 링크를 만들지 못했습니다.'
      showToast(message)
    } finally {
      setSharing(false)
      shareBusyRef.current = false
    }
  }, [scenario, showToast, token, uploadPdfInBackground])

  const closeDialog = useCallback(() => {
    if (sharing) return
    setDialogOpen(false)
  }, [sharing])

  const copyShareLink = useCallback(async () => {
    const url = shareResult?.shareUrl
    if (!url) return
    const ok = await copyTextToClipboard(url)
    showToast(ok ? '공유 링크를 복사했습니다.' : '링크를 복사하지 못했습니다.')
  }, [shareResult?.shareUrl, showToast])

  const nativeShare = useCallback(async () => {
    const url = shareResult?.shareUrl
    if (!url || !canUseWebShare()) return
    const payload = buildCoverageShareWebSharePayload({
      shareUrl: url,
      customerName: scenario?.customerNameSnapshot ?? scenario?.customerName,
      title: scenario?.title,
    })
    try {
      await navigator.share(payload)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      showToast('공유하기를 실행하지 못했습니다.')
    }
  }, [scenario?.customerName, scenario?.customerNameSnapshot, scenario?.title, shareResult?.shareUrl, showToast])

  return {
    canShare,
    dialogOpen,
    phase,
    sharing,
    shareUrl: shareResult?.shareUrl ?? null,
    openShareDialog,
    createShare,
    closeDialog,
    copyShareLink,
    nativeShare,
    canNativeShare: canUseWebShare(),
    sharePdfFileName: scenario ? buildCoveragePdfFileName(scenario) : null,
  }
}
