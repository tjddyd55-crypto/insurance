import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import { copyTextToClipboard } from '../../../lib/clipboard'
import {
  createUserInsurerAccountShareLink,
  fetchUserInsurerAccountShareLink,
  resolveAccountVaultSharePageUrl,
} from '../api/userInsurerAccountShareApi'

export type AccountVaultShareLinkViewProps = ReturnType<typeof useAccountVaultShareLinkState>

export function useAccountVaultShareLinkState(authToken: string) {
  const token = authToken.trim()
  const [shareUrlRaw, setShareUrlRaw] = useState<string | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState('')

  const shareUrl = useMemo(
    () => resolveAccountVaultSharePageUrl(shareUrlRaw, shareToken),
    [shareToken, shareUrlRaw],
  )

  const load = useCallback(async () => {
    if (!token) {
      setShareUrlRaw(null)
      setShareToken(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await fetchUserInsurerAccountShareLink(token)
      setShareUrlRaw(data.shareUrl)
      setShareToken(data.token)
    } catch (e) {
      setShareUrlRaw(null)
      setShareToken(null)
      setError(e instanceof ApiError ? e.message : '외부 URL 정보를 불러오지 못했습니다.')
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
    setError('')
    setCopyFeedback('')
    try {
      const data = await createUserInsurerAccountShareLink(token)
      setShareUrlRaw(data.shareUrl)
      setShareToken(data.token)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '외부 URL을 생성하지 못했습니다.')
    } finally {
      setPending(false)
    }
  }, [token])

  const copyShareLink = useCallback(async () => {
    if (!shareUrl) {
      return
    }
    const ok = await copyTextToClipboard(shareUrl)
    setCopyFeedback(ok ? '복사됨' : '복사 실패')
    if (ok) {
      window.setTimeout(() => {
        setCopyFeedback((prev) => (prev === '복사됨' ? '' : prev))
      }, 1500)
    }
  }, [shareUrl])

  const openShareLink = useCallback(() => {
    if (!shareUrl) {
      return
    }
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
  }, [shareUrl])

  return {
    shareUrl,
    hasShareUrl: Boolean(shareUrl),
    loading,
    pending,
    error,
    copyFeedback,
    onCreateShareLink: createOrRegenerate,
    onRegenerateShareLink: createOrRegenerate,
    onCopyShareLink: copyShareLink,
    onOpenShareLink: openShareLink,
  }
}
