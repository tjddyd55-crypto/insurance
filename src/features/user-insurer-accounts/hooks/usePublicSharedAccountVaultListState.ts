import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPublicSharedAccountUsers } from '../api/publicSharedAccountListVaultApi'
import type { SharedAccountUser } from '../api/accountShareVisibilityApi'
import type { SharedAccountVaultListViewProps } from './useSharedAccountVaultListState'

export function usePublicSharedAccountVaultListState(
  listToken: string,
  onOpenUser: (user: SharedAccountUser) => void,
): SharedAccountVaultListViewProps {
  const token = listToken.trim()
  const [users, setUsers] = useState<SharedAccountUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!token) {
      setError('유효하지 않은 링크입니다.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    void fetchPublicSharedAccountUsers(token)
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
    totalUserCount: users.length,
    loading,
    error,
    search,
    onSearchChange,
    onOpenUser,
    publicMode: true,
  }
}
