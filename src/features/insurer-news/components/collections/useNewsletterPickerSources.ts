import { useEffect, useState } from 'react'
import type { NewsletterItem } from '../../types'
import { fetchNewsletterPickerSources } from '../../services/newsletterCollections.service'

/**
 * t299 — 소식지 선택기 공통 목록 (서버 `/insurer-news/picker-sources`).
 * 원수사 · 공용 · 자기 GA 소식지 중 로그인 사용자가 열람 가능한 것만 내려온다.
 */
export function useNewsletterPickerSources(token: string | null | undefined, enabled = true) {
  const [items, setItems] = useState<NewsletterItem[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled || !token?.trim()) {
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const rows = await fetchNewsletterPickerSources(token)
        if (!cancelled) setItems(rows)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '소식지를 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, token])

  return { items, loading, error }
}
