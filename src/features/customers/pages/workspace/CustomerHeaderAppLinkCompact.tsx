import { useCallback, useEffect, useMemo, useState } from 'react'
import { FormButton } from '../../../../components/form'
import { useAuth } from '../../../auth/AuthProvider'
import { getCustomerAppLink, type CustomerAppLinkInfo } from '../../../claim-requests/api/claimRequestsApi'
import {
  CUSTOMER_APP_LINK_UPDATED_EVENT,
  resolveCustomerAppConnectionState,
} from '../../../claim-requests/model/customerAppLinkConnection'

function resolveLinkUrl(info: CustomerAppLinkInfo | null): string {
  return String(info?.universalUrl ?? info?.connectUrl ?? '').trim()
}

function pillMeta(state: ReturnType<typeof resolveCustomerAppConnectionState>): { label: string; className: string } {
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
    if (!feedback) return
    const timerId = window.setTimeout(() => setFeedback(''), 2500)
    return () => window.clearTimeout(timerId)
  }, [feedback])

  const connectionState = useMemo(() => resolveCustomerAppConnectionState(linkStatus), [linkStatus])
  const pill = useMemo(() => pillMeta(connectionState), [connectionState])
  const linkUrl = useMemo(() => resolveLinkUrl(linkStatus), [linkStatus])

  const handleCopyLink = useCallback(async () => {
    if (!linkUrl) {
      setFeedback('복사할 연결 링크가 없습니다.')
      return
    }
    try {
      if (!navigator?.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(linkUrl)
      setFeedback('연결 링크 복사 완료')
    } catch {
      setFeedback('연결 링크 복사 실패')
    }
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
        disabled={!linkUrl}
        onClick={() => void handleCopyLink()}
        title={linkUrl ? '클립보드에 연결 URL 복사' : '생성된 연결 링크가 없습니다.'}
      >
        연결 링크 복사
      </FormButton>
      {feedback ? <span className="customer-workspace-layout__claim-copy-result">{feedback}</span> : null}
    </div>
  )
}
