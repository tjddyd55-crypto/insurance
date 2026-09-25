import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { useAuth } from '../../auth/AuthProvider'
import { mapCoverageShareCreateError } from '../api/mapCoverageShareApiError'
import type { CreateCoverageShareResponse } from '../api/coverageSimulatorShareApi'
import { useCoverageSimulatorScope } from '../CoverageSimulatorScope'
import { buildCoverageShareWebSharePayload } from '../domain/coverageShareCopy'
import { normalizeConsultation } from '../domain/normalizeConsultation'
import type { CoverageScenario } from '../domain/types'
import { canUseWebShare, copyTextToClipboard } from '../lib/clipboard'
import { buildCoveragePdfFileName } from '../pdf/coveragePdfFileName'
import { CoverageSimulatorPrintDocument } from '../pdf/CoverageSimulatorPrintDocument'
import {
  COVERAGE_PDF_CAPTURE_WIDTH_PX,
  waitForCoveragePdfLayout,
} from '../pdf/coveragePdfCapture'
import { buildCoveragePdfBlobFromPrintRoot } from '../pdf/generateCoveragePdf'
import {
  canShowCoverageShareButton,
  isPreviewShareClientEnabled,
  resolveCoverageShareProviderMode,
} from '../share/coverageShareProviderMode'
import { createCoverageShareProvider } from '../share/createCoverageShareProvider'
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
  host.style.width = `${COVERAGE_PDF_CAPTURE_WIDTH_PX}px`
  host.style.background = 'var(--cs-color-surface, white)'
  document.body.appendChild(host)
  const mount = document.createElement('div')
  host.appendChild(mount)
  let root: Root | null = null
  try {
    root = createRoot(mount)
    root.render(<CoverageSimulatorPrintDocument scenario={scenario} />)
    const printRoot = mount.firstElementChild as HTMLElement | null
    if (!printRoot) {
      throw new Error('PDF 렌더 루트를 찾을 수 없습니다.')
    }
    await waitForCoveragePdfLayout(printRoot)
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
  const provider = useMemo(
    () => createCoverageShareProvider(providerMode, token),
    [providerMode, token],
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [phase] = useState<'result'>('result')
  const [sharing, setSharing] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [shareResult, setShareResult] = useState<CreateCoverageShareResponse | null>(null)
  const shareBusyRef = useRef(false)

  const consultationId = scenario?.id ?? null
  // Draft와 저장본은 동일 id를 유지하므로 consultationId만으로 memoize하면
  // 저장 직후에도 false가 고정된다. 렌더마다 localStorage SSOT를 확인한다.
  const isPersistedConsultation = Boolean(
    consultationId && getScenarioById(userKey, consultationId),
  )

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
    provider,
    consultationId,
    enabled: historyEnabled,
  })

  const loadShareHistory = history.load

  useEffect(() => {
    if (!dialogOpen || !historyEnabled) return
    void loadShareHistory()
  }, [dialogOpen, historyEnabled, loadShareHistory])

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
      const saveResult = await requestSaveConsultation(scenario.title)
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
      const authed = await provider?.ensureAccess()
      if (!authed) {
        showToast('로그인이 만료되었습니다. 다시 로그인해 주세요.')
        return
      }
    }
    setShareResult(null)
    setCreateError(null)
    setDialogOpen(true)
  }, [ensureSaved, provider, providerMode, showShareButton, showToast, token])

  const uploadPdfInBackground = useCallback(
    async (shareId: string, snapshot: CoverageScenario) => {
      if (!provider) return
      try {
        const blob = await buildSharePdfBlob(snapshot)
        await provider.uploadSharePdf(shareId, blob)
      } catch {
        // public viewer snapshot fallback
      }
    },
    [provider],
  )

  const ensureShareLink = useCallback(async (): Promise<string | null> => {
    if (shareResult?.shareUrl) return shareResult.shareUrl
    if (!scenario || !provider || shareBusyRef.current || !canExecuteShare) return null
    const authed = await provider.ensureAccess()
    if (!authed && provider.mode === 'crm') {
      setCreateError('로그인이 만료되었습니다. 다시 로그인한 후 공유해 주세요.')
      return null
    }
    const snapshot = normalizeConsultation(getScenarioById(userKey, scenario.id) ?? scenario)
    shareBusyRef.current = true
    setSharing(true)
    setCreateError(null)
    try {
      const created = await provider.createShare(snapshot)
      setShareResult(created)
      history.invalidate()
      void history.load(true)
      void uploadPdfInBackground(created.shareId, snapshot)
      return created.shareUrl
    } catch (error) {
      setCreateError(
        provider.mode === 'preview-dev'
          ? 'DEV 공유 링크를 생성하지 못했습니다. 다시 시도해 주세요.'
          : mapCoverageShareCreateError(error),
      )
      return null
    } finally {
      setSharing(false)
      shareBusyRef.current = false
    }
  }, [canExecuteShare, history, provider, scenario, shareResult?.shareUrl, uploadPdfInBackground, userKey])

  const createShare = useCallback(async () => {
    await ensureShareLink()
  }, [ensureShareLink])

  const closeDialog = useCallback(() => {
    if (sharing) return
    setDialogOpen(false)
    setCreateError(null)
  }, [sharing])

  const copyShareLink = useCallback(async () => {
    const url = await ensureShareLink()
    if (!url) return
    const ok = await copyTextToClipboard(url)
    showToast(ok ? '공유 링크를 복사했습니다.' : '링크를 복사하지 못했습니다.')
  }, [ensureShareLink, showToast])

  const copyHistoryLink = useCallback(async (url: string | null) => {
    if (!url) return
    const ok = await copyTextToClipboard(url)
    showToast(ok ? '공유 링크를 복사했습니다.' : '링크를 복사하지 못했습니다.')
  }, [showToast])

  const revokeShare = useCallback(
    async (shareId: string) => {
      if (!provider) return
      try {
        await provider.revokeShare(shareId)
        history.invalidate()
        await history.load(true)
      } catch {
        setCreateError('공유 중지에 실패했습니다. 다시 시도해 주세요.')
      }
    },
    [history, provider],
  )

  const nativeShare = useCallback(async () => {
    if (!canUseWebShare()) return
    const url = await ensureShareLink()
    if (!url) return
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
  }, [ensureShareLink, scenario?.customerName, scenario?.customerNameSnapshot, scenario?.title, showToast])

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
