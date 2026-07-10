import { useCallback, useEffect, useRef, useState } from 'react'
import { FormButton } from '../../../components/form'
import { apiRequest } from '../../../lib/apiClient'
import type { NewsletterLinkPreview } from '../types'
import { LinkPreviewCard } from './LinkPreviewCard'
import { extractFirstExternalUrl } from '../utils/linkTextParser.js'

type Props = {
  bodyText: string
  authToken: string | null
  initialPreview?: NewsletterLinkPreview | null
  onPreviewChange: (preview: NewsletterLinkPreview | null) => void
}

type PreviewApiRaw = {
  url?: string
  title?: string
  description?: string
  imageUrl?: string
  image?: string
  siteName?: string
  domain?: string
}

type PreviewApiResponse = {
  success?: boolean
  preview?: PreviewApiRaw | null
  data?: PreviewApiRaw | null
}

function mapPreview(raw: PreviewApiRaw): NewsletterLinkPreview | null {
  const url = String(raw.url ?? '').trim()
  if (!url) {
    return null
  }
  return {
    url,
    title: raw.title ?? null,
    description: raw.description ?? null,
    imageUrl: raw.imageUrl ?? raw.image ?? null,
    siteName: raw.siteName ?? null,
    domain: raw.domain ?? null,
  }
}

async function fetchLinkPreview(token: string, url: string): Promise<NewsletterLinkPreview | null> {
  const res = await apiRequest<PreviewApiResponse>('/api/insurer-news/link-preview', {
    method: 'POST',
    token,
    body: JSON.stringify({ url }),
  })
  const raw = res?.preview ?? res?.data ?? null
  if (!raw) {
    return null
  }
  return mapPreview(raw)
}

/**
 * 작성/수정 폼용 링크 미리보기 — debounce + 요청 순서 가드.
 * 미리보기 실패해도 글 저장은 막지 않는다.
 */
export function LinkPreviewEditor({
  bodyText,
  authToken,
  initialPreview = null,
  onPreviewChange,
}: Props) {
  const [preview, setPreview] = useState<NewsletterLinkPreview | null>(initialPreview)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [removed, setRemoved] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const requestIdRef = useRef(0)
  const lastFetchedUrlRef = useRef(String(initialPreview?.url ?? '').trim())

  const applyPreview = useCallback(
    (next: NewsletterLinkPreview | null) => {
      setPreview(next)
      onPreviewChange(next)
    },
    [onPreviewChange],
  )

  useEffect(() => {
    if (removed) {
      return
    }
    const url = extractFirstExternalUrl(bodyText)
    if (!url) {
      lastFetchedUrlRef.current = ''
      applyPreview(null)
      setError('')
      setLoading(false)
      return
    }
    if (refreshNonce === 0 && url === lastFetchedUrlRef.current && preview?.url === url) {
      return
    }
    if (!authToken?.trim()) {
      return
    }

    const requestId = ++requestIdRef.current
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        setError('')
        try {
          const next = await fetchLinkPreview(authToken, url)
          if (requestId !== requestIdRef.current) {
            return
          }
          lastFetchedUrlRef.current = url
          if (!next) {
            setError('미리보기를 불러오지 못했습니다.')
            applyPreview(null)
            return
          }
          applyPreview(next)
        } catch {
          if (requestId !== requestIdRef.current) {
            return
          }
          setError('미리보기를 불러오지 못했습니다.')
          applyPreview(null)
        } finally {
          if (requestId === requestIdRef.current) {
            setLoading(false)
          }
        }
      })()
    }, 600)

    return () => {
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- URL/refresh 변경 시에만 재요청
  }, [bodyText, authToken, removed, refreshNonce, applyPreview])

  if (removed) {
    return (
      <div className="insurer-news-link-preview-editor">
        <p className="insurer-news-muted" style={{ margin: '0 0 8px', fontSize: 13 }}>
          링크 미리보기가 제거되었습니다.
        </p>
        <FormButton
          htmlType="button"
          variant="secondary"
          onClick={() => {
            setRemoved(false)
            lastFetchedUrlRef.current = ''
            setRefreshNonce((n) => n + 1)
          }}
        >
          미리보기 다시 불러오기
        </FormButton>
      </div>
    )
  }

  if (!extractFirstExternalUrl(bodyText) && !preview) {
    return null
  }

  return (
    <div className="insurer-news-link-preview-editor">
      {loading ? (
        <p className="insurer-news-muted" style={{ margin: '0 0 8px', fontSize: 13 }}>
          링크 미리보기 불러오는 중…
        </p>
      ) : null}
      {error && !preview ? (
        <p className="insurer-news-muted" style={{ margin: '0 0 8px', fontSize: 13 }}>
          {error}
        </p>
      ) : null}
      {preview ? <LinkPreviewCard preview={preview} /> : null}
      {preview || error ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {preview ? (
            <FormButton
              htmlType="button"
              variant="secondary"
              onClick={() => {
                setRemoved(true)
                setError('')
                setLoading(false)
                lastFetchedUrlRef.current = ''
                applyPreview(null)
              }}
            >
              미리보기 제거
            </FormButton>
          ) : null}
          <FormButton
            htmlType="button"
            variant="secondary"
            onClick={() => {
              lastFetchedUrlRef.current = ''
              setRefreshNonce((n) => n + 1)
            }}
          >
            새로고침
          </FormButton>
        </div>
      ) : null}
    </div>
  )
}
