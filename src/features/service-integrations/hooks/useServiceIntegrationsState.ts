import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ApiError } from '../../../lib/apiClient'
import { fetchSmsBalance } from '../../sms/api/smsApi'
import {
  connectServiceIntegration,
  disconnectServiceIntegration,
  fetchServiceIntegrations,
  type ServiceIntegrationCard,
} from '../api/serviceIntegrationsApi'

export type ServiceIntegrationsViewProps = {
  loading: boolean
  error: string
  notice: string
  balanceText: string
  providers: ServiceIntegrationCard[]
  busyKey: string
  onConnect: (provider: ServiceIntegrationCard) => void
  onDisconnect: (provider: ServiceIntegrationCard) => void
  onOpenSettings: (provider: ServiceIntegrationCard) => void
  onRefreshBalance: () => void
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return '서비스 연동 정보를 불러오지 못했습니다.'
}

function googleCallbackMessage(google: string | null, reason: string | null): { notice?: string; error?: string } {
  if (google === 'connected') {
    if (reason === 'tasks_scope_missing') {
      return { notice: 'Google 계정이 연결되었습니다. Tasks 읽기 권한이 없어 할 일 일부가 표시되지 않을 수 있습니다.' }
    }
    return { notice: 'Google 계정이 연결되었습니다.' }
  }
  if (google === 'error') {
    if (reason === 'access_denied') {
      return { error: 'Google 동의가 취소되어 연결되지 않았습니다.' }
    }
    return { error: 'Google 계정 연결에 실패했습니다.' }
  }
  return {}
}

export const GOOGLE_CARD_KEY = 'google_calendar'
/** 데스크톱 앱 Google 연동: 시스템 브라우저 동의 후 상태를 다시 읽는 간격·최대 시간(서버 state TTL 10분). */
export const DESKTOP_OAUTH_POLL_MS = 4000
export const DESKTOP_OAUTH_WATCH_MS = 10 * 60 * 1000

function isGoogleAuthUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && url.hostname === 'accounts.google.com'
  } catch {
    return false
  }
}

/** 데스크톱(Electron) 앱 안에서 실행 중인가. preload 가 electronAPI 를 노출한다. */
export function isDesktopAppRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI)
}

export function useServiceIntegrationsState(): ServiceIntegrationsViewProps {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [providers, setProviders] = useState<ServiceIntegrationCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [balanceText, setBalanceText] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [desktopOAuthUntil, setDesktopOAuthUntil] = useState(0)
  const desktopOAuthUntilRef = useRef(0)

  const load = useCallback(async () => {
    if (!token?.trim()) {
      setProviders([])
      setLoading(false)
      setError('로그인이 필요합니다.')
      return
    }
    setLoading(true)
    try {
      setProviders(await fetchServiceIntegrations(token))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    setProviders([])
    setNotice('')
    void load()
  }, [load])

  useEffect(() => {
    const google = searchParams.get('google')
    if (!google) {
      return
    }
    const reason = searchParams.get('reason')
    const { notice: oauthNotice, error: oauthError } = googleCallbackMessage(google, reason)
    if (oauthNotice) {
      setNotice(oauthNotice)
      setError('')
    } else if (oauthError) {
      setError(oauthError)
    }
    const next = new URLSearchParams(searchParams)
    next.delete('google')
    next.delete('reason')
    setSearchParams(next, { replace: true })
    void load()
  }, [load, searchParams, setSearchParams])

  /* 데스크톱: 시스템 브라우저에서 동의를 마치고 앱으로 돌아오면(focus) 또는 짧은 주기로 상태를 다시 읽는다. */
  useEffect(() => {
    if (!desktopOAuthUntil || !token?.trim()) {
      return
    }
    let stopped = false
    const stop = () => {
      stopped = true
      desktopOAuthUntilRef.current = 0
      setDesktopOAuthUntil(0)
    }
    const check = async () => {
      if (stopped) return
      if (Date.now() > desktopOAuthUntilRef.current) {
        stop()
        return
      }
      try {
        const next = await fetchServiceIntegrations(token)
        if (stopped) return
        setProviders(next)
        if (next.some((item) => item.key === GOOGLE_CARD_KEY && item.status === 'connected')) {
          setNotice('Google 계정이 연결되었습니다.')
          setError('')
          stop()
        }
      } catch {
        /* 다음 주기에 다시 확인 */
      }
    }
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(() => void check(), DESKTOP_OAUTH_POLL_MS)
    return () => {
      stopped = true
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [desktopOAuthUntil, token])

  const onConnect = useCallback((provider: ServiceIntegrationCard) => {
    if (!token?.trim() || busyKey) {
      return
    }
    setBusyKey(provider.key)
    setError('')
    const desktopGoogle = provider.key === GOOGLE_CARD_KEY && isDesktopAppRuntime()
    void connectServiceIntegration(token, provider.key, desktopGoogle ? { client: 'desktop' } : {})
      .then((result) => {
        if (result.url && desktopGoogle) {
          if (!isGoogleAuthUrl(result.url)) {
            setError('Google 연동 주소가 올바르지 않습니다.')
            return
          }
          /* 앱 셸이 window.open 을 시스템 브라우저(shell.openExternal)로 연다. */
          window.open(result.url, '_blank', 'noopener,noreferrer')
          setNotice('브라우저에서 Google 동의를 마친 뒤 ONE FC 앱으로 돌아오면 연동됨으로 바뀝니다.')
          const until = Date.now() + DESKTOP_OAUTH_WATCH_MS
          desktopOAuthUntilRef.current = until
          setDesktopOAuthUntil(until)
          return
        }
        if (result.url) {
          window.location.assign(result.url)
          return
        }
        if (result.path) {
          navigate(result.path)
          return
        }
        setNotice('연동 요청을 보냈습니다.')
        return load()
      })
      .catch((connectError: unknown) => {
        setError(errorMessage(connectError))
      })
      .finally(() => setBusyKey(''))
  }, [busyKey, load, navigate, token])

  const onDisconnect = useCallback((provider: ServiceIntegrationCard) => {
    if (!token?.trim() || busyKey) {
      return
    }
    setBusyKey(provider.key)
    setError('')
    void disconnectServiceIntegration(token, provider.key)
      .then(() => {
        setNotice(`${provider.name} 연동을 해제했습니다.`)
        return load()
      })
      .catch((disconnectError: unknown) => setError(errorMessage(disconnectError)))
      .finally(() => setBusyKey(''))
  }, [busyKey, load, token])

  const onOpenSettings = useCallback((provider: ServiceIntegrationCard) => {
    if (provider.settingsPath) {
      navigate(provider.settingsPath)
    }
  }, [navigate])

  const onRefreshBalance = useCallback(() => {
    if (!token?.trim()) {
      return
    }
    void fetchSmsBalance(token)
      .then((result) => setBalanceText(result.balanceText ?? '잔액을 확인하지 못했습니다.'))
      .catch((balanceError: unknown) => setError(errorMessage(balanceError)))
  }, [token])

  return {
    loading,
    error,
    notice,
    balanceText,
    providers,
    busyKey,
    onConnect,
    onDisconnect,
    onOpenSettings,
    onRefreshBalance,
  }
}
