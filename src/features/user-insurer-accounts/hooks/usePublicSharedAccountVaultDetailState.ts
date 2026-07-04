import { useEffect, useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import { fetchPublicSharedUserAccounts } from '../api/publicSharedAccountListVaultApi'

export function usePublicSharedAccountVaultDetailState(
  listToken: string,
  targetUserId: string,
  initialName: string,
) {
  const token = listToken.trim()
  const userId = targetUserId.trim()
  const [ownerName, setOwnerName] = useState(initialName)
  const [metaLoading, setMetaLoading] = useState(!initialName)
  const [accessError, setAccessError] = useState('')

  useEffect(() => {
    if (!token || !userId) {
      setAccessError('유효하지 않은 접근입니다.')
      setMetaLoading(false)
      return
    }
    if (initialName.trim()) {
      setOwnerName(initialName)
      setMetaLoading(false)
      setAccessError('')
      return
    }
    let cancelled = false
    setMetaLoading(true)
    setAccessError('')
    void fetchPublicSharedUserAccounts(token, userId)
      .then((result) => {
        if (!cancelled) {
          setOwnerName(result.ownerDisplayName)
        }
      })
      .catch((error) => {
        if (cancelled) {
          return
        }
        if (error instanceof ApiError && (error.status === 403 || error.status === 410)) {
          setAccessError(
            error.status === 410
              ? '만료되었거나 유효하지 않은 링크입니다.'
              : '공유된 계정관리에 접근할 권한이 없습니다.',
          )
          return
        }
        setAccessError('계정관리 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) {
          setMetaLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [initialName, token, userId])

  return { ownerName, metaLoading, accessError }
}
