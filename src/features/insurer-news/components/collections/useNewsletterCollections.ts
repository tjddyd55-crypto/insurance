import { useCallback, useEffect, useState } from 'react'
import {
  fetchNewsletterCollections,
  setNewsletterFavorite,
  type NewsletterCollections,
} from '../../services/newsletterCollections.service'

const EMPTY: NewsletterCollections = { folders: [], favoriteNewsletterIds: [] }

/** 로그인 사용자 본인의 소식지 폴더·즐겨찾기 상태 (서버가 사용자 단위로 격리). */
export function useNewsletterCollections(token: string | null | undefined, enabled: boolean) {
  const [data, setData] = useState<NewsletterCollections>(EMPTY)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled || !token?.trim()) return
    try {
      const next = await fetchNewsletterCollections(token)
      setData(next)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '내 폴더를 불러오지 못했습니다.')
    } finally {
      setLoaded(true)
    }
  }, [enabled, token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const isFavorite = useCallback((id: string) => data.favoriteNewsletterIds.includes(id), [data])

  const toggleFavorite = useCallback(
    async (id: string) => {
      const next = !data.favoriteNewsletterIds.includes(id)
      setData((prev) => ({
        ...prev,
        favoriteNewsletterIds: next
          ? [id, ...prev.favoriteNewsletterIds.filter((v) => v !== id)]
          : prev.favoriteNewsletterIds.filter((v) => v !== id),
      }))
      try {
        await setNewsletterFavorite(token, id, next)
      } catch (e) {
        await refresh()
        throw e
      }
    },
    [data, refresh, token],
  )

  return { data, error, loaded, refresh, isFavorite, toggleFavorite }
}

export type NewsletterCollectionsState = ReturnType<typeof useNewsletterCollections>
