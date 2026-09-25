import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { fetchMe } from '../../auth/authApi'
import { useAuth } from '../../auth/AuthProvider'
import { mapCoverageShareCreateError } from '../api/mapCoverageShareApiError'
import {
  createCoverageSimulationShare,
  revokeCoverageSimulationShare,
  uploadCoverageSharePdf,
  type CreateCoverageShareResponse,
} from '../api/coverageSimulatorShareApi'
import {
  createPreviewCoverageSimulationShare,
  revokePreviewCoverageSimulationShare,
  uploadPreviewCoverageSharePdf,
} from '../api/coverageSimulatorPreviewShareApi'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { buildCoverageShareWebSharePayload } from '../domain/coverageShareCopy'
import { normalizeConsultation } from '../domain/normalizeConsultation'
import type { CoverageScenario } from '../domain/types'
import { canUseWebShare, copyTextToClipboard } from '../lib/clipboard'
import { buildCoveragePdfFileName } from '../pdf/coveragePdfFileName'
import { CoverageSimulatorPrintDocument } from '../pdf/CoverageSimulatorPrintDocument'
import { buildCoveragePdfBlobFromPrintRoot } from '../pdf/generateCoveragePdf'
import {
  canShowCoverageShareButton,
  isPreviewShareClientEnabled,
  resolveCoverageShareProviderMode,
} from '../share/coverageShareProviderMode'
import { getScenarioById } from '../storage/scenarioRepository'
import type { SaveConsultationResult } from './useScenarioEditor'
import { useCoverageShareHistory } from './useCoverageShareHistory'

type ConfirmFn = (options: {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
}) => Promise<boolean>

type Params = {
  scenario: CoverageScenario | null
  isTemplate: boolean
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

export function useCoverageShareFlow({
  scenario,
  isTemplate,
  isDirty,
  requestSaveConsultation,
  showToast,
  confirm,
}: Params) {
  const { token, isAuthenticated } = useAuth()
  const { userKey, layoutMode } = useCoverageSimulatorScope()
  const providerMode = resolveCoverageShareProviderMode(layoutMode)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [phase, setPhase] = useState<'confirm' | 'result'>('confirm')
  const [sharing, setSharing] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [shareResult, setShareResult] = useState<CreateCoverageShareResponse | null>(null)
  const shareBusyRef = useRef(false)

  const consultationId = scenario?.id ?? null
  const isPersistedConsultation = useMemo(() => {
    if (!consultationId) return false
    return Boolean(getScenarioById(userKey, consultationId))
  }, [consultationId, userKey])

  const showShareButton = canShowCoverageShareButton({ isTemplate, hasScenario: Boolean(scenario) })

  const canExecuteShare = useMemo(() => {
    if (!scenario || !isPersistedConsultation) return false
    if (providerMode === 'preview-dev') return isPreviewShareClientEnabled()
    return Boolean(isAuthenticated && token)
  }, [isAuthenticated, isPersistedConsultation, providerMode, scenario, token])

  const historyEnabled =
    Boolean(consultationId) &&
    isPersistedConsultation &&
    (providerMode === 'preview-dev' ? isPreviewShareClientEnabled() : Boolean(token))

  const history = useCoverageShareHistory({
    providerMode,
    token,
    consultationId,
    enabled: historyEnabled,
  })

  const loadShareHistory = history.load

  useEffect(() => {
    if (!dialogOpen || !historyEnabled) return
    void loadShareHistory()
  }, [dialogOpen, historyEnabled, loadShareHistory])

  const ensureAuthSession = useCallback(async (): Promise<boolean> => {
    if (providerMode === 'preview-dev') return true
    if (!token) return false
    try {
      await fetchMe(token)
      return true
    } catch {
      return false
    }
  }, [providerMode, token])

  const ensureSaved = useCallback(async (): Promise<CoverageScenario | null> => {
    if (!scenario) return null
    if (!isPersistedConsultation || isDirty()) {
      const ok = await confirm({
        title: '변경사항을 저장한 후 공유합니다.',
        message: '공유 링크에는 저장된 상담 내용이 반영됩니다.',
        confirmLabel: '저장 후 공유',
        cancelLabel: '취소',
      })
      if (!ok) return null
    }
    if (isDirty() || !isPersistedConsultation) {
      const saveResult = await requestSaveConsultation()
      if ('needsTitle' in saveResult && saveResult.needsTitle) {
        showToast(saveResult.validationError ?? '제목을 입력한 후 저장해 주세요.')
        return null
      }
      if (!saveResult.ok) {
        showToast(saveResult.toast)
        return null
      }
    }
    const latest = getScenarioById(userKey, scenario.id) ?? scenario
    return normalizeConsultation(latest)
  }, [
    confirm,
    isDirty,
    isPersistedConsultation,
    requestSaveConsultation,
    scenario,
    showToast,
    userKey,
  ])

  const openShareDialog = useCallback(async () => {
    if (!showShareButton) return
    if (providerMode === 'crm' && !token) {
      showToast('CRM에 로그인한 후 공유할 수 있습니다.')
      return
    }
    if (providerMode === 'preview-dev' && !isPreviewShareClientEnabled()) {
      showToast('Preview 공유는 DEV 환경에서만 사용할 수 있습니다.')
      return
    }
    const saved = await ensureSaved()
    if (!saved) return
    if (providerMode === 'crm') {
      const authed = await ensureAuthSession()
      if (!authed) {
        showToast('로그인이 만료되었습니다. 다시 로그인해 주세요.')
        return
      }
    }
    setShareResult(null)
    setCreateError(null)
    setPhase('confirm')
    setDialogOpen(true)
  }, [ensureAuthSession, ensureSaved, providerMode, showShareButton, showToast, token])

  const uploadPdfInBackground = useCallback(
    async (shareId: string, snapshot: CoverageScenario) => {
      try {
        const blob = await buildSharePdfBlob(snapshot)
        if (providerMode === 'preview-dev') {
          await uploadPreviewCoverageSharePdf(shareId, blob)
        } else if (token) {
          await uploadCoverageSharePdf(token, shareId, blob)
        }
      } catch {
        // public viewer snapshot fallback
      }
    },
    [providerMode, token],
  )

  const createShare = useCallback(async () => {
    if (!scenario || shareBusyRef.current || !canExecuteShare) return
    const authed = await ensureAuthSession()
    if (!authed) {
      setCreateError('로그인이 만료되었습니다. 다시 로그인한 후 공유해 주세요.')
      return
    }
    const snapshot = normalizeConsultation(getScenarioById(userKey, scenario.id) ?? scenario)
    shareBusyRef.current = true
    setSharing(true)
    setCreateError(null)
    try {
      const created =
        providerMode === 'preview-dev'
          ? await createPreviewCoverageSimulationShare(snapshot.id, snapshot)
          : await createCoverageSimulationShare(token!, snapshot.id, snapshot)
      setShareResult(created)
      setPhase('result')
      history.invalidate()
      void history.load(true)
      void uploadPdfInBackground(created.shareId, snapshot)
    } catch (error) {
      setCreateError(mapCoverageShareCreateError(error))
    } finally {
      setSharing(false)
      shareBusyRef.current = false
    }
  }, [canExecuteShare, ensureAuthSession, history, providerMode, scenario, token, uploadPdfInBackground, userKey])

  const closeDialog = useCallback(() => {
    if (sharing) return
    setDialogOpen(false)
    setCreateError(null)
  }, [sharing])

  const copyShareLink = useCallback(async () => {
    const url = shareResult?.shareUrl
    if (!url) return
    const ok = await copyTextToClipboard(url)
    showToast(ok ? '공유 링크를 복사했습니다.' : '링크를 복사하지 못했습니다.')
  }, [shareResult?.shareUrl, showToast])

  const copyHistoryLink = useCallback(async (url: string | null) => {
    if (!url) return
    const ok = await copyTextToClipboard(url)
    showToast(ok ? '공유 링크를 복사했습니다.' : '링크를 복사하지 못했습니다.')
  }, [showToast])

  const revokeShare = useCallback(
    async (shareId: string) => {
      try {
        if (providerMode === 'preview-dev') {
          await revokePreviewCoverageSimulationShare(shareId)
        } else if (token) {
          await revokeCoverageSimulationShare(token, shareId)
        }
        history.invalidate()
        await history.load(true)
      } catch {
        setCreateError('공유 중지에 실패했습니다. 다시 시도해 주세요.')
      }
    },
    [history, providerMode, token],
  )

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
    showShareButton,
    canExecuteShare,
    providerMode,
    dialogOpen,
    phase,
    sharing,
    createError,
    shareUrl: shareResult?.shareUrl ?? null,
    shareHistory: history.shares,
    shareHistoryLoading: history.loading,
    shareHistoryError: history.error,
    reloadShareHistory: () => void history.load(true),
    openShareDialog,
    createShare,
    closeDialog,
    copyShareLink,
    copyHistoryLink,
    revokeShare,
    nativeShare,
    canNativeShare: canUseWebShare(),
    sharePdfFileName: scenario ? buildCoveragePdfFileName(scenario) : null,
  }
}
