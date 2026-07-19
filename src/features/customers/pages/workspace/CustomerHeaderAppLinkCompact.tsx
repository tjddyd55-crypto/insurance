import { useCallback, useEffect, useMemo, useState } from 'react'
import { FormButton } from '../../../../components/form'
import { useAuth } from '../../../auth/AuthProvider'
import {
  getCustomerAppLink,
  type CustomerAppLinkInfo,
} from '../../../claim-requests/api/claimRequestsApi'
import {
  CUSTOMER_APP_LINK_UPDATED_EVENT,
  resolveCustomerAppConnectionState,
} from '../../../claim-requests/model/customerAppLinkConnection'
import CustomerLinkShareModal from '../../components/CustomerLinkShareModal'

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
  customerName?: string
  customerPhone?: string
}

export default function CustomerHeaderAppLinkCompact({
  customerId,
  customerPhone = '',
}: Props) {
  const { token } = useAuth()
  const [linkStatus, setLinkStatus] = useState<CustomerAppLinkInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
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
    const t = window.setTimeout(() => setFeedback(''), 3500)
    return () => window.clearTimeout(t)
  }, [feedback])

  const connectionState = useMemo(() => resolveCustomerAppConnectionState(linkStatus), [linkStatus])
  const pill = useMemo(() => pillMeta(connectionState), [connectionState])

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
        className="customer-header-app-link-compact__send"
        disabled={!token?.trim()}
        onClick={() => setShareOpen(true)}
        title="고객앱 접속 링크를 복사하거나 문자/카카오톡으로 보냅니다."
      >
        고객앱 발송
      </FormButton>
      {feedback ? <span className="customer-workspace-layout__claim-copy-result">{feedback}</span> : null}
      <CustomerLinkShareModal
        open={shareOpen}
        mode="customer-app"
        token={token}
        customerId={customerId}
        prefilledPhone={customerPhone}
        onClose={() => setShareOpen(false)}
        onFeedback={setFeedback}
      />
    </div>
  )
}
