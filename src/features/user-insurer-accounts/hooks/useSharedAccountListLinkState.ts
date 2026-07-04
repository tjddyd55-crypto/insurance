import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { copyTextToClipboard } from '../../../lib/clipboard'
import { useConfirmDialog } from '../../../components/dialog'
import {
  createSharedAccountListLink,
  fetchSharedAccountListLink,
  regenerateSharedAccountListLink,
  resolveSharedAccountListPageUrl,
} from '../api/sharedAccountListLinkApi'

const STATUS_FLASH_MS = 1500

type StatusFlash = 'created' | 'copied' | null
type ErrorKind = 'create' | 'load' | null

export type SharedAccountListLinkViewProps = ReturnType<typeof useSharedAccountListLinkState>

export function useSharedAccountListLinkState(authToken: string) {
  const token = authToken.trim()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [shareUrlRaw, setShareUrlRaw] = useState<string | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [errorKind, setErrorKind] = useState<ErrorKind>(null)
  const [statusFlash, setStatusFlash] = useState<StatusFlash>(null)
  const flashTimerRef = useRef<number | null>(null)

  const shareUrl = useMemo(
    () => resolveSharedAccountListPageUrl(shareUrlRaw, shareToken),
    [shareToken, shareUrlRaw],
  )

  const hasShareUrl = Boolean(shareUrl)

  const clearStatusFlashTimer = useCallback(() => {
    if (flashTimerRef.current != null) {
      window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = null
    }
  }, [])

  const flashStatus = useCallback(
    (flash: Exclude<StatusFlash, null>) => {
      clearStatusFlashTimer()
      setStatusFlash(flash)
      flashTimerRef.current = window.setTimeout(() => {
        setStatusFlash((prev) => (prev === flash ? null : prev))
        flashTimerRef.current = null
      }, STATUS_FLASH_MS)
    },
    [clearStatusFlashTimer],
  )

  useEffect(() => {
    return () => {
      clearStatusFlashTimer()
    }
  }, [clearStatusFlashTimer])

  const statusLabel = useMemo(() => {
    if (loading) {
      return ''
    }
    if (errorKind === 'create') {
      return '생성 실패'
    }
    if (errorKind === 'load') {
      return '처리 실패'
    }
    if (statusFlash === 'copied') {
      return '복사됨'
    }
    if (statusFlash === 'created') {
      return '새 URL 생성됨'
    }
    if (hasShareUrl) {
      return '외부 URL 활성'
    }
    return '외부 URL 없음'
  }, [errorKind, hasShareUrl, loading, statusFlash])

  const load = useCallback(async () => {
    if (!token) {
      setShareUrlRaw(null)
      setShareToken(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setErrorKind(null)
    try {
      const data = await fetchSharedAccountListLink(token)
      setShareUrlRaw(data.shareUrl)
      setShareToken(data.token)
    } catch {
      setShareUrlRaw(null)
      setShareToken(null)
      setErrorKind('load')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const createShareLink = useCallback(async () => {
    if (!token) {
      return
    }
    setPending(true)
    setErrorKind(null)
    setStatusFlash(null)
    clearStatusFlashTimer()
    try {
      const data = await createSharedAccountListLink(token)
      setShareUrlRaw(data.shareUrl)
      setShareToken(data.token)
      flashStatus('created')
    } catch {
      setErrorKind('create')
    } finally {
      setPending(false)
    }
  }, [clearStatusFlashTimer, flashStatus, token])

  const confirmAndRegenerate = useCallback(async () => {
    if (!token || pending) {
      return
    }
    const confirmed = await confirm({
      title: '공유 목록 URL을 새로 생성하시겠습니까?',
      message:
        '새로 생성하면 기존 목록 URL은 더 이상 사용할 수 없습니다. 기존 URL을 사용 중인 경우 접속이 차단될 수 있습니다. 계속 진행하시겠습니까?',
      confirmLabel: '새로생성',
      cancelLabel: '취소',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }
    setPending(true)
    setErrorKind(null)
    setStatusFlash(null)
    clearStatusFlashTimer()
    try {
      const data = await regenerateSharedAccountListLink(token)
      setShareUrlRaw(data.shareUrl)
      setShareToken(data.token)
      flashStatus('created')
    } catch {
      setErrorKind('create')
    } finally {
      setPending(false)
    }
  }, [clearStatusFlashTimer, confirm, flashStatus, pending, token])

  const copyShareLink = useCallback(async () => {
    if (!shareUrl) {
      return
    }
    setErrorKind(null)
    const ok = await copyTextToClipboard(shareUrl)
    if (ok) {
      flashStatus('copied')
      return
    }
    setErrorKind('load')
  }, [flashStatus, shareUrl])

  const openShareLink = useCallback(() => {
    if (!shareUrl) {
      return
    }
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
  }, [shareUrl])

  return {
    shareUrl,
    hasShareUrl,
    loading,
    pending,
    statusLabel,
    onCreateShareLink: createShareLink,
    onRegenerateShareLink: confirmAndRegenerate,
    onCopyShareLink: copyShareLink,
    onOpenShareLink: openShareLink,
    confirmDialog,
  }
}
