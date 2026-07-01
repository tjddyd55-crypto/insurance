import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { copyTextToClipboard } from '../../../lib/clipboard'
import {
  createUserInsurerAccountShareLink,
  fetchUserInsurerAccountShareLink,
  resolveAccountVaultSharePageUrl,
} from '../api/userInsurerAccountShareApi'

const STATUS_FLASH_MS = 1500

type StatusFlash = 'created' | 'copied' | null
type ErrorKind = 'create' | 'load' | null

export type AccountVaultShareLinkViewProps = ReturnType<typeof useAccountVaultShareLinkState>

export function useAccountVaultShareLinkState(authToken: string) {
  const token = authToken.trim()
  const [shareUrlRaw, setShareUrlRaw] = useState<string | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [errorKind, setErrorKind] = useState<ErrorKind>(null)
  const [statusFlash, setStatusFlash] = useState<StatusFlash>(null)
  const flashTimerRef = useRef<number | null>(null)

  const shareUrl = useMemo(
    () => resolveAccountVaultSharePageUrl(shareUrlRaw, shareToken),
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
      const data = await fetchUserInsurerAccountShareLink(token)
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

  const createOrRegenerate = useCallback(async () => {
    if (!token) {
      return
    }
    setPending(true)
    setErrorKind(null)
    setStatusFlash(null)
    clearStatusFlashTimer()
    try {
      const data = await createUserInsurerAccountShareLink(token)
      setShareUrlRaw(data.shareUrl)
      setShareToken(data.token)
      flashStatus('created')
    } catch {
      setErrorKind('create')
    } finally {
      setPending(false)
    }
  }, [clearStatusFlashTimer, flashStatus, token])

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
    onCreateShareLink: createOrRegenerate,
    onRegenerateShareLink: createOrRegenerate,
    onCopyShareLink: copyShareLink,
    onOpenShareLink: openShareLink,
  }
}
