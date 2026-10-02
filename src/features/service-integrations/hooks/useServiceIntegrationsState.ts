import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ApiError } from '../../../lib/apiClient'
import { fetchSmsBalance } from '../../sms/api/smsApi'
import {
  connectServiceIntegration,
  disconnectServiceIntegration,
  fetchServiceIntegrations,
  googleConnectErrorMessage,
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

  const load = useCallback(async () => {
    if (!token?.trim()) {
      setProviders([])
      setLoading(false)
      setError('로그인이 필요합니다.')
      return
    }
    setLoading(true)
    setError('')
    // 다른 사용자로 다시 로그인하면 이전 사용자 카드(이메일 등)를 남기지 않는다.
    setProviders([])
    try {
      setProviders(await fetchServiceIntegrations(token))
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  // Google OAuth callback 이 돌려보낸 결과(?google=connected|error&reason=)를 한 번 보여주고 주소에서 지운다.
  const googleResult = searchParams.get('google')
  const googleReason = searchParams.get('reason')
  useEffect(() => {
    if (!googleResult) {
      return
    }
    if (googleResult === 'connected') {
      setNotice(googleReason === 'tasks_scope_missing'
        ? 'Google 계정이 연결되었습니다. Google Tasks 읽기 권한은 허용되지 않아 Google 할 일은 표시되지 않습니다. 다시 연결하면 허용할 수 있습니다.'
        : 'Google 계정이 연결되었습니다.')
    } else {
      setError(googleConnectErrorMessage(googleReason))
    }
    const next = new URLSearchParams(searchParams)
    next.delete('google')
    next.delete('reason')
    setSearchParams(next, { replace: true })
  }, [googleReason, googleResult, searchParams, setSearchParams])

  const onConnect = useCallback((provider: ServiceIntegrationCard) => {
    if (!token?.trim() || busyKey) {
      return
    }
    setBusyKey(provider.key)
    setError('')
    void connectServiceIntegration(token, provider.key)
      .then((result) => {
        if (result.url) {
          // 서버가 state 를 만든 Google 동의 화면으로 이동. 토큰은 브라우저에 오지 않는다.
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
