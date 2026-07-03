import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchSharedAccountUsers, type SharedAccountUser } from '../api/accountShareVisibilityApi'

export type SharedAccountVaultListViewProps = {
  users: SharedAccountUser[]
  loading: boolean
  error: string
  search: string
  onSearchChange: (value: string) => void
  onOpenUser: (user: SharedAccountUser) => void
}

/**
 * 공유 ON 사용자 목록 상태. 검색은 사용자 이름 기준 클라이언트 필터만 적용한다.
 * @param authToken 인증 토큰
 * @param onOpenUser 이름 클릭 시 상세로 이동시키는 콜백(라우팅은 컨테이너 소유)
 */
export function useSharedAccountVaultListState(
  authToken: string,
  onOpenUser: (user: SharedAccountUser) => void,
): SharedAccountVaultListViewProps {
  const token = authToken.trim()
  const [users, setUsers] = useState<SharedAccountUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    void fetchSharedAccountUsers(token)
      .then((rows) => {
        if (!cancelled) {
          setUsers(rows)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('공유 계정관리 목록을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) {
      return users
    }
    return users.filter((user) => user.name.toLowerCase().includes(keyword))
  }, [search, users])

  const onSearchChange = useCallback((value: string) => setSearch(value), [])

  return {
    users: filtered,
    loading,
    error,
    search,
    onSearchChange,
    onOpenUser,
  }
}
