import { useCallback, useEffect, useMemo, useState } from 'react'
import { FormButton } from '../../../../components/form'
import { useAuth } from '../../../auth/AuthProvider'
import {
  createCustomerAppLink,
  getCustomerAppLink,
  type CustomerAppLinkInfo,
} from '../../../claim-requests/api/claimRequestsApi'
import {
  CUSTOMER_APP_LINK_UPDATED_EVENT,
  customerAppLinkActionLabel,
  notifyCustomerAppLinkUpdated,
  resolveCustomerAppConnectionState,
} from '../../../claim-requests/model/customerAppLinkConnection'

function resolveLinkUrl(info: CustomerAppLinkInfo | null): string {
  return String(info?.universalUrl ?? info?.connectUrl ?? '').trim()
}

function resolveDisplayCode(info: CustomerAppLinkInfo | null): string {
  return String(info?.agentCode ?? info?.linkCode ?? '').trim()
}

function pillMeta(state: ReturnType<typeof resolveCustomerAppConnectionState>): {
  label: string
  className: string
} {
  switch (state) {
    case 'connected':
      return {
        label: '앱 연결',
        className: 'customer-workspace-app-link-bar__pill customer-workspace-app-link-bar__pill--ok',
      }
    case 'link_created':
      return {
        label: '앱 미연결',
        className: 'customer-workspace-app-link-bar__pill customer-workspace-app-link-bar__pill--pending',
      }
    case 'expired':
      return {
        label: '링크 만료',
        className: 'customer-workspace-app-link-bar__pill customer-workspace-app-link-bar__pill--expired',
      }
    default:
      return {
        label: '링크 미생성',
        className: 'customer-workspace-app-link-bar__pill',
      }
  }
}

type Props = {
  customerId: number
}

export default function CustomerHeaderAppLinkCompact({ customerId }: Props) {
  const { token } = useAuth()
  const [linkStatus, setLinkStatus] = useState<CustomerAppLinkInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  const loadStatus = useCallback(async () => {
    if (!token?.trim() || !customerId) {
      setLinkStatus(null)
      return
    }
    setLoading(true)
    try {
      const status = await getCustomerAppLink(token, customerId)
      setLinkStatus(status)
    } catch {
      setLinkStatus(null)
    } finally {
      setLoading(false)
    }
  }, [token, customerId])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  useEffect(() => {
    const onUpdated = () => {
      void loadStatus()
    }
    window.addEventListener(CUSTOMER_APP_LINK_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(CUSTOMER_APP_LINK_UPDATED_EVENT, onUpdated)
  }, [loadStatus])

  useEffect(() => {
    const onFocus = () => {
      void loadStatus()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadStatus])

  useEffect(() => {
    if (!feedback) {
      return
    }
    const t = window.setTimeout(() => setFeedback(''), 2500)
    return () => window.clearTimeout(t)
  }, [feedback])

  const connectionState = useMemo(() => resolveCustomerAppConnectionState(linkStatus), [linkStatus])
  const actionLabel = useMemo(() => customerAppLinkActionLabel(connectionState), [connectionState])
  const pill = useMemo(() => pillMeta(connectionState), [connectionState])
  const linkUrl = useMemo(() => resolveLinkUrl(linkStatus), [linkStatus])
  const displayCode = useMemo(() => resolveDisplayCode(linkStatus), [linkStatus])

  const copyText = useCallback(async (value: string, okMsg: string, errMsg: string) => {
    if (!value.trim()) {
      setFeedback(errMsg)
      return
    }
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('clipboard unavailable')
      }
      await navigator.clipboard.writeText(value)
      setFeedback(okMsg)
    } catch {
      setFeedback(errMsg)
    }
  }, [])

  const handleCreateLink = useCallback(async () => {
    if (!token?.trim()) {
      setFeedback('로그인이 필요합니다.')
      return
    }
    setActionBusy(true)
    setFeedback('')
    try {
      const res = await createCustomerAppLink(token, customerId)
      const url = String(res.universalUrl ?? res.connectUrl ?? '').trim()
      if (!url) {
        setFeedback('링크 응답 형식이 올바르지 않습니다.')
        return
      }
      setLinkStatus(res)
      notifyCustomerAppLinkUpdated()
      await loadStatus()
      setFeedback('링크를 생성했습니다.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '링크 생성에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }, [token, customerId, loadStatus])

  const handleCopyLink = useCallback(() => {
    void copyText(linkUrl, '연결 링크 복사 완료', '연결 링크 복사 실패')
  }, [copyText, linkUrl])

  const handleCopyCode = useCallback(() => {
    void copyText(displayCode, '코드 복사 완료', '복사할 코드가 없습니다.')
  }, [copyText, displayCode])

  const handleSms = useCallback(async () => {
    if (!linkUrl) {
      setFeedback('먼저 링크를 생성해 주세요.')
      return
    }
    await copyText(linkUrl, 'URL 복사 완료', '복사 실패')
    window.location.href = `sms:?body=${encodeURIComponent(linkUrl)}`
  }, [copyText, linkUrl])

  const handleKakao = useCallback(async () => {
    if (!linkUrl) {
      setFeedback('먼저 링크를 생성해 주세요.')
      return
    }
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('clipboard unavailable')
      }
      await navigator.clipboard.writeText(linkUrl)
      setFeedback('카카오톡으로 공유할 URL을 복사했습니다.')
    } catch {
      setFeedback('복사 실패')
    }
  }, [linkUrl])

  const handlePreview = useCallback(() => {
    if (!linkUrl) {
      setFeedback('먼저 링크를 생성해 주세요.')
      return
    }
    window.open(linkUrl, '_blank', 'noopener,noreferrer')
  }, [linkUrl])

  return (
    <div
      className="customer-workspace-layout__claim-link-tools customer-header-app-link-compact"
      aria-label="고객앱 연결"
    >
      <span className={pill.className} title={loading ? '연결 상태 확인 중' : undefined}>
        {loading ? '확인 중…' : pill.label}
      </span>
      <FormButton
        htmlType="button"
        variant="secondary"
        size="sm"
        loading={actionBusy}
        disabled={!token?.trim()}
        onClick={() => void handleCreateLink()}
      >
        {actionLabel}
      </FormButton>
      <FormButton
        htmlType="button"
        variant="secondary"
        size="sm"
        disabled={!linkUrl}
        onClick={handleCopyLink}
        title={linkUrl ? '클립보드에 연결 URL 복사' : '생성된 연결 링크가 없습니다.'}
      >
        연결 링크 복사
      </FormButton>
      <div className="customer-workspace-app-link-bar__actions">
        <FormButton htmlType="button" variant="secondary" size="sm" disabled={!displayCode} onClick={handleCopyCode}>
          코드
        </FormButton>
        <FormButton htmlType="button" variant="secondary" size="sm" disabled={!linkUrl} onClick={() => void handleSms()}>
          문자
        </FormButton>
        <FormButton htmlType="button" variant="secondary" size="sm" disabled={!linkUrl} onClick={() => void handleKakao()}>
          카카오
        </FormButton>
        <FormButton htmlType="button" variant="secondary" size="sm" disabled={!linkUrl} onClick={handlePreview}>
          미리보기
        </FormButton>
      </div>
      {feedback ? <span className="customer-workspace-layout__claim-copy-result">{feedback}</span> : null}
    </div>
  )
}
