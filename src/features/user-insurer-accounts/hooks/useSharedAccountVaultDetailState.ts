import { useEffect, useState } from 'react'
import { ApiError } from '../../../lib/apiClient'
import { fetchSharedUserAccounts } from '../api/accountShareVisibilityApi'

/**
 * 스태프 계정관리 상세의 배너용 소유자 이름/접근 상태를 해석한다.
 *
 * @param authToken 인증 토큰
 * @param targetUserId 대상 사용자 id
 * @param initialName 목록 클릭 시 넘어온 이름(있으면 즉시 배너 표시, 없으면 서버 조회)
 */
export function useSharedAccountVaultDetailState(
  authToken: string,
  targetUserId: string,
  initialName: string,
) {
  const token = authToken.trim()
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
    // 이름을 이미 받았으면 배너 표기는 즉시 가능하다. 접근 권한은
    // AccountVaultManager 의 계정 조회에서 서버가 재검증하므로 중복 fetch 를 피한다.
    if (initialName.trim()) {
      setOwnerName(initialName)
      setMetaLoading(false)
      setAccessError('')
      return
    }
    let cancelled = false
    setMetaLoading(true)
    setAccessError('')
    void fetchSharedUserAccounts(token, userId)
      .then((result) => {
        if (!cancelled) {
          setOwnerName(result.ownerDisplayName)
        }
      })
      .catch((error) => {
        if (cancelled) {
          return
        }
        if (error instanceof ApiError && error.status === 403) {
          setAccessError('공유된 계정관리에 접근할 권한이 없습니다.')
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
