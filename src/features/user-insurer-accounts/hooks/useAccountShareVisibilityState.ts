import { useCallback, useEffect, useState } from 'react'
import {
  fetchAccountShareVisibility,
  updateAccountShareVisibility,
} from '../api/accountShareVisibilityApi'

export type AccountShareVisibilityViewProps = ReturnType<typeof useAccountShareVisibilityState>

/**
 * 계정관리 "스태프 공유" ON/OFF 상태를 소유자 화면에서 관리한다.
 * 기존 공유 URL 토큰 로직과는 완전히 분리된 별도 기능이다.
 */
export function useAccountShareVisibilityState(authToken: string) {
  const token = authToken.trim()
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    void fetchAccountShareVisibility(token)
      .then((value) => {
        if (!cancelled) {
          setEnabled(value)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('공유 설정을 불러오지 못했습니다.')
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

  const toggle = useCallback(
    async (next: boolean) => {
      if (!token || pending) {
        return
      }
      setPending(true)
      setError('')
      try {
        const applied = await updateAccountShareVisibility(token, next)
        setEnabled(applied)
      } catch {
        setError('공유 설정 변경에 실패했습니다.')
      } finally {
        setPending(false)
      }
    },
    [pending, token],
  )

  return { enabled, loading, pending, error, onToggle: toggle }
}
