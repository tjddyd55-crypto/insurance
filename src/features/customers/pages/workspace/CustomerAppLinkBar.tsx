import { useCallback, useEffect, useMemo, useState } from 'react'
import { FormButton, FormInput } from '../../../../components/form'
import { useAuth } from '../../../auth/AuthProvider'
import {
  createCustomerAppLink,
  getCustomerAppLink,
  type CustomerAppLinkInfo,
} from '../../../claim-requests/api/claimRequestsApi'
import {
  CUSTOMER_APP_LINK_UPDATED_EVENT,
  customerAppLinkActionLabel,
  describeCustomerAppConnection,
  notifyCustomerAppLinkUpdated,
  resolveCustomerAppConnectionState,
} from '../../../claim-requests/model/customerAppLinkConnection'

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

type CustomerAppLinkBarProps = {
  customerId: number
}

/**
 * 고객 작업영역 shell 전용 — 청구 탭 콘텐츠와 무관하게 `customerId`만으로 표시한다.
 */
export default function CustomerAppLinkBar({ customerId }: CustomerAppLinkBarProps) {
  const { token } = useAuth()
  const [linkStatus, setLinkStatus] = useState<CustomerAppLinkInfo | null>(null)
  const [linkStatusLoading, setLinkStatusLoading] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [createdLink, setCreatedLink] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const [copyResult, setCopyResult] = useState('')
  const [localError, setLocalError] = useState('')

  const loadLinkStatus = useCallback(async () => {
    if (!token?.trim() || !customerId) {
      setLinkStatus(null)
      return
    }
    setLinkStatusLoading(true)
    try {
      const current = await getCustomerAppLink(token, customerId)
      setLinkStatus(current)
    } catch {
      setLinkStatus(null)
    } finally {
      setLinkStatusLoading(false)
    }
  }, [customerId, token])

  useEffect(() => {
    void loadLinkStatus()
  }, [loadLinkStatus])

  useEffect(() => {
    const onRefresh = () => void loadLinkStatus()
    window.addEventListener(CUSTOMER_APP_LINK_UPDATED_EVENT, onRefresh)
    return () => window.removeEventListener(CUSTOMER_APP_LINK_UPDATED_EVENT, onRefresh)
  }, [loadLinkStatus])

  useEffect(() => {
    setCreatedLink('')
    setCreatedCode('')
    setCopyResult('')
    setLocalError('')
  }, [customerId])

  const connectionState = useMemo(() => resolveCustomerAppConnectionState(linkStatus), [linkStatus])
  const connectionMeta = useMemo(
    () => describeCustomerAppConnection(connectionState, linkStatus, formatDateTime),
    [connectionState, linkStatus],
  )
  const displayedCode = createdCode || linkStatus?.agentCode || linkStatus?.linkCode || ''
  const displayedLink = createdLink || linkStatus?.universalUrl || ''
  const linkActionLabel = customerAppLinkActionLabel(connectionState)

  const handleCopyText = useCallback(async (value: string, label: string) => {
    if (!value.trim()) return
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('clipboard API unavailable')
      }
      await navigator.clipboard.writeText(value)
      setCopyResult(`${label} 복사 완료`)
    } catch {
      setCopyResult(`${label} 복사 실패`)
    }
  }, [])

  const handleCreateLink = async () => {
    if (!token?.trim()) return
    setActionBusy(true)
    setCreatedLink('')
    setCreatedCode('')
    setLocalError('')
    try {
      const res = await createCustomerAppLink(token, customerId)
      const linkUrl = res.universalUrl || ''
      if (!linkUrl) {
        setLocalError('링크 응답 형식이 올바르지 않습니다.')
        return
      }
      setCreatedLink(linkUrl)
      setCreatedCode(String(res.agentCode ?? res.linkCode ?? '').trim())
      await loadLinkStatus()
      notifyCustomerAppLinkUpdated()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : '링크 생성에 실패했습니다.')
    } finally {
      setActionBusy(false)
    }
  }

  const handleOpenLinkPreview = useCallback(() => {
    if (!displayedLink.trim()) return
    window.open(displayedLink, '_blank', 'noopener,noreferrer')
  }, [displayedLink])

  const handleShareBySms = useCallback(async () => {
    if (!displayedLink.trim()) {
      setLocalError('먼저 링크를 생성해 주세요.')
      return
    }
    await handleCopyText(displayedLink, 'URL')
    window.location.href = `sms:?body=${encodeURIComponent(displayedLink)}`
  }, [displayedLink, handleCopyText])

  const handleShareByKakao = useCallback(async () => {
    if (!displayedLink.trim()) {
      setLocalError('먼저 링크를 생성해 주세요.')
      return
    }
    await handleCopyText(displayedLink, 'URL')
    setCopyResult('카카오톡으로 공유할 URL을 복사했습니다.')
  }, [displayedLink, handleCopyText])

  const statusPillClass =
    connectionState === 'connected'
      ? 'customer-workspace-app-link-bar__pill customer-workspace-app-link-bar__pill--ok'
      : connectionState === 'link_created'
        ? 'customer-workspace-app-link-bar__pill customer-workspace-app-link-bar__pill--pending'
        : connectionState === 'expired'
          ? 'customer-workspace-app-link-bar__pill customer-workspace-app-link-bar__pill--expired'
          : 'customer-workspace-app-link-bar__pill'

  return (
    <div className="customer-workspace-app-link-bar" aria-label="고객앱 연결">
      {linkStatusLoading ? (
        <span className="customer-workspace-app-link-bar__loading">연결 상태 확인 중…</span>
      ) : null}
      <span className={statusPillClass} title={connectionMeta.subtitle}>
        {connectionMeta.title}
      </span>
      <span className="customer-workspace-app-link-bar__code" title={displayedCode || '연결 코드 없음'}>
        코드: {displayedCode || '—'}
      </span>
      <FormInput
        className="customer-workspace-app-link-bar__url"
        value={displayedLink || ''}
        readOnly
        placeholder="링크 미생성"
        title={displayedLink || undefined}
      />
      <div className="customer-workspace-app-link-bar__actions">
        <FormButton htmlType="button" variant="primary" size="sm" onClick={() => void handleCreateLink()} loading={actionBusy}>
          {linkActionLabel}
        </FormButton>
        <FormButton
          htmlType="button"
          variant="secondary"
          size="sm"
          onClick={() => void handleCopyText(displayedLink, '연결 링크')}
          disabled={!displayedLink}
        >
          링크 복사
        </FormButton>
        <FormButton
          htmlType="button"
          variant="secondary"
          size="sm"
          onClick={() => void handleCopyText(displayedCode, '연결 코드')}
          disabled={!displayedCode}
        >
          코드 복사
        </FormButton>
        <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => void handleShareBySms()} disabled={!displayedLink}>
          문자
        </FormButton>
        <FormButton htmlType="button" variant="secondary" size="sm" onClick={() => void handleShareByKakao()} disabled={!displayedLink}>
          카카오
        </FormButton>
        <FormButton htmlType="button" variant="secondary" size="sm" onClick={handleOpenLinkPreview} disabled={!displayedLink}>
          미리보기
        </FormButton>
      </div>
      {copyResult ? <span className="customer-workspace-app-link-bar__hint">{copyResult}</span> : null}
      {localError ? <span className="customer-workspace-app-link-bar__err">{localError}</span> : null}
    </div>
  )
}
