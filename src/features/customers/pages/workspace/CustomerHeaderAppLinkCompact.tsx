import { useCallback, useEffect, useMemo, useState } from 'react'
import { FormButton } from '../../../../components/form'
import { useConfirmDialog } from '../../../../components/dialog'
import { useAuth } from '../../../auth/AuthProvider'
import { ApiError } from '../../../../lib/apiClient'
import { copyTextToClipboard } from '../../../../lib/clipboard'
import {
  createCustomerAppLink,
  getCustomerAppLink,
  sendCustomerAppLinkAlimtalk,
  type CustomerAppLinkInfo,
} from '../../../claim-requests/api/claimRequestsApi'
import {
  CUSTOMER_APP_LINK_UPDATED_EVENT,
  notifyCustomerAppLinkUpdated,
  resolveCustomerAppConnectionState,
} from '../../../claim-requests/model/customerAppLinkConnection'

function resolveLinkUrl(info: CustomerAppLinkInfo | null): string {
  return String(info?.universalUrl ?? info?.connectUrl ?? '').trim()
}

function formatPhoneDisplay(raw: string): string {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return String(raw ?? '').trim()
}

function hasValidMobile(raw: string): boolean {
  const d = String(raw ?? '').replace(/\D/g, '')
  return /^01[0-9]\d{7,8}$/.test(d)
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
  customerName?: string
  customerPhone?: string
}

export default function CustomerHeaderAppLinkCompact({
  customerId,
  customerName = '',
  customerPhone = '',
}: Props) {
  const { token } = useAuth()
  const { confirm, confirmDialog } = useConfirmDialog()
  const [linkStatus, setLinkStatus] = useState<CustomerAppLinkInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [copyBusy, setCopyBusy] = useState(false)
  const [alimtalkBusy, setAlimtalkBusy] = useState(false)
  const [feedback, setFeedback] = useState('')

  const phoneOk = useMemo(() => hasValidMobile(customerPhone), [customerPhone])
  const displayName = String(customerName ?? '').trim() || '고객'
  const displayPhone = formatPhoneDisplay(customerPhone)

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

  const handleCopyLink = useCallback(async () => {
    if (!token?.trim()) {
      setFeedback('로그인이 필요합니다.')
      return
    }
    setCopyBusy(true)
    setFeedback('')
    try {
      let url = resolveLinkUrl(linkStatus)
      const needsCreate =
        !url || connectionState === 'not_created' || connectionState === 'expired'
      if (needsCreate) {
        const res = await createCustomerAppLink(token, customerId)
        url = String(res.universalUrl ?? res.connectUrl ?? '').trim()
        if (!url) {
          setFeedback('링크 응답 형식이 올바르지 않습니다.')
          return
        }
        setLinkStatus(res)
        notifyCustomerAppLinkUpdated()
        await loadStatus()
      }
      const copied = await copyTextToClipboard(url)
      if (!copied) {
        throw new Error('클립보드에 복사하지 못했습니다.')
      }
      setFeedback('연결 링크가 복사되었습니다.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '연결 링크 복사 실패')
    } finally {
      setCopyBusy(false)
    }
  }, [token, customerId, linkStatus, connectionState, loadStatus])

  const handleSendAlimtalk = useCallback(async () => {
    if (!token?.trim()) {
      setFeedback('로그인이 필요합니다.')
      return
    }
    if (!phoneOk) {
      setFeedback('고객 휴대폰번호가 없어 알림톡을 보낼 수 없습니다.')
      return
    }
    const ok = await confirm({
      title: '고객앱 링크를 알림톡으로 보낼까요?',
      message: (
        <div className="customer-header-app-link-compact__alimtalk-confirm">
          <p>
            {displayName} 고객에게 고객앱 접속 링크를 알림톡으로 보냅니다.
          </p>
          <p>
            수신번호:
            <br />
            <strong>{displayPhone || '—'}</strong>
          </p>
        </div>
      ),
      confirmLabel: '발송',
      cancelLabel: '취소',
    })
    if (!ok) return

    setAlimtalkBusy(true)
    setFeedback('')
    try {
      const result = await sendCustomerAppLinkAlimtalk(token, customerId)
      if (result.status === 'dry_run') {
        setFeedback('알림톡 발송 테스트가 완료되었습니다.')
      } else if (result.status === 'sent') {
        setFeedback('알림톡을 발송했습니다.')
      } else {
        const reason = String(result.providerMessage ?? '').trim()
        setFeedback(reason ? `알림톡 발송에 실패했습니다. 사유: ${reason}` : '알림톡 발송에 실패했습니다.')
      }
      notifyCustomerAppLinkUpdated()
      await loadStatus()
    } catch (error) {
      if (error instanceof ApiError) {
        const data = error.data as { providerMessage?: string; error?: string } | undefined
        const reason = String(data?.providerMessage ?? error.message ?? '').trim()
        setFeedback(
          reason && reason !== '요청 처리에 실패했습니다.'
            ? `알림톡 발송에 실패했습니다. 사유: ${reason}`
            : '알림톡 발송에 실패했습니다.',
        )
      } else {
        setFeedback(error instanceof Error ? error.message : '알림톡 발송에 실패했습니다.')
      }
    } finally {
      setAlimtalkBusy(false)
    }
  }, [token, customerId, phoneOk, displayName, displayPhone, confirm, loadStatus])

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
        className="customer-header-app-link-compact__copy"
        loading={copyBusy}
        disabled={!token?.trim() || alimtalkBusy}
        onClick={() => void handleCopyLink()}
        title="연결 URL을 클립보드에 복사합니다. 링크가 없으면 생성한 뒤 복사합니다."
      >
        연결 링크 복사
      </FormButton>
      <FormButton
        htmlType="button"
        variant="secondary"
        size="sm"
        className="customer-header-app-link-compact__alimtalk"
        loading={alimtalkBusy}
        disabled={!token?.trim() || !phoneOk || copyBusy}
        onClick={() => void handleSendAlimtalk()}
        title={
          phoneOk
            ? '고객앱 접속 링크를 카카오 알림톡으로 보냅니다.'
            : '고객 휴대폰번호가 없어 알림톡을 보낼 수 없습니다.'
        }
      >
        고객앱 알림톡
      </FormButton>
      {feedback ? <span className="customer-workspace-layout__claim-copy-result">{feedback}</span> : null}
      {confirmDialog}
    </div>
  )
}
