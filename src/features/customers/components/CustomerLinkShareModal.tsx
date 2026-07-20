import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FormButton, FormInput } from '../../../components/form'
import { BaseDialog } from '../../../components/dialog'
import { useBackButtonClose } from '../../../hooks/useBackButtonClose'
import { ApiError } from '../../../lib/apiClient'
import { copyTextToClipboard } from '../../../lib/clipboard'
import { getPublicOrigin } from '../../../lib/publicOrigin'
import { applyFormInputFormat, PHONE_INPUT_PLACEHOLDER } from '../../../utils/inputFormatters'
import { buildCustomerRegistrationInviteUrl } from '../utils/buildCustomerRegistrationInviteUrl'
import {
  fetchCustomerRegistrationSmsAvailability,
  sendCustomerRegistrationAlimtalk,
  sendCustomerRegistrationSms,
} from '../api/customerRegistrationShareApi'
import {
  fetchCustomerAppSmsAvailability,
  sendCustomerAppAlimtalkShare,
  sendCustomerAppSms,
} from '../api/customerAppShareApi'
import {
  createCustomerAppLink,
  getCustomerAppLink,
  type CustomerAppLinkInfo,
} from '../../claim-requests/api/claimRequestsApi'
import {
  notifyCustomerAppLinkUpdated,
  resolveCustomerAppConnectionState,
} from '../../claim-requests/model/customerAppLinkConnection'

const SMS_DISABLED_DEFAULT = '알리고 문자 설정이 완료된 경우에만 사용할 수 있습니다.'
const MISSING_CUSTOMER_PHONE_HINT =
  '고객 휴대폰번호가 없어 문자/카카오톡 발송을 할 수 없습니다. 링크 복사로 직접 전달해 주세요.'
const MISSING_CUSTOMER_PHONE_REASON = '고객 휴대폰번호가 없습니다.'
const STATUS_CLEAR_MS = 2800

function digitsOnly(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '')
}

function isValidMobile(raw: string): boolean {
  return /^01[0-9]\d{7,8}$/.test(digitsOnly(raw))
}

function resolveLinkUrl(info: CustomerAppLinkInfo | null): string {
  return String(info?.universalUrl ?? info?.connectUrl ?? '').trim()
}

export type CustomerLinkShareMode = 'registration' | 'customer-app'

type Props = {
  open: boolean
  mode: CustomerLinkShareMode
  token: string | null | undefined
  /** registration */
  username?: string
  gaCode?: string
  /** customer-app */
  customerId?: number
  prefilledPhone?: string
  onClose: () => void
  onFeedback: (message: string) => void
}

export default function CustomerLinkShareModal({
  open,
  mode,
  token,
  username = '',
  gaCode = '',
  customerId,
  prefilledPhone = '',
  onClose,
  onFeedback,
}: Props) {
  const isCustomerApp = mode === 'customer-app'
  const [receiver, setReceiver] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [smsAvailable, setSmsAvailable] = useState(false)
  const [smsDisabledReason, setSmsDisabledReason] = useState(SMS_DISABLED_DEFAULT)
  const [copying, setCopying] = useState(false)
  const [sendingSms, setSendingSms] = useState(false)
  const [sendingAlimtalk, setSendingAlimtalk] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusTone, setStatusTone] = useState<'info' | 'success' | 'error'>('info')
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const validReceiver = useMemo(() => isValidMobile(receiver), [receiver])
  const busy = copying || sendingSms || sendingAlimtalk
  const hasReceiverInput = digitsOnly(receiver).length > 0
  const customerPhoneMissing = isCustomerApp && !isValidMobile(prefilledPhone) && !validReceiver

  const resolveRegistrationUrl = useCallback(() => {
    const origin = getPublicOrigin()
    return buildCustomerRegistrationInviteUrl({
      origin,
      refUsername: username,
      gaCode,
    })
  }, [username, gaCode])

  const showStatus = useCallback((message: string, tone: 'info' | 'success' | 'error' = 'info') => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current)
      statusTimerRef.current = null
    }
    setStatusMessage(message)
    setStatusTone(tone)
    statusTimerRef.current = setTimeout(() => {
      setStatusMessage('')
      statusTimerRef.current = null
    }, STATUS_CLEAR_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }
    setStatusMessage('')
    if (isCustomerApp) {
      setReceiver(applyFormInputFormat('phone', prefilledPhone || ''))
      setShareUrl('')
    } else {
      setReceiver('')
      setShareUrl(resolveRegistrationUrl())
    }
  }, [open, isCustomerApp, prefilledPhone, resolveRegistrationUrl])

  useEffect(() => {
    if (!open || !token?.trim()) {
      setSmsAvailable(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        if (isCustomerApp) {
          if (!customerId || customerId < 1) {
            if (!cancelled) {
              setSmsAvailable(false)
              setSmsDisabledReason(SMS_DISABLED_DEFAULT)
            }
            return
          }
          const avail = await fetchCustomerAppSmsAvailability(token, customerId)
          if (cancelled) return
          setSmsAvailable(Boolean(avail.available))
          setSmsDisabledReason(avail.reason?.trim() || SMS_DISABLED_DEFAULT)
        } else {
          const avail = await fetchCustomerRegistrationSmsAvailability(token)
          if (cancelled) return
          setSmsAvailable(Boolean(avail.available))
          setSmsDisabledReason(avail.reason?.trim() || SMS_DISABLED_DEFAULT)
        }
      } catch {
        if (cancelled) return
        setSmsAvailable(false)
        setSmsDisabledReason(SMS_DISABLED_DEFAULT)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, token, isCustomerApp, customerId])

  const ensureCustomerAppUrl = useCallback(async (): Promise<string> => {
    if (!token?.trim() || !customerId || customerId < 1) {
      return ''
    }
    let info = await getCustomerAppLink(token, customerId)
    let url = resolveLinkUrl(info)
    const state = resolveCustomerAppConnectionState(info)
    const needsCreate = !url || state === 'not_created' || state === 'expired'
    if (needsCreate) {
      info = await createCustomerAppLink(token, customerId)
      url = resolveLinkUrl(info)
      notifyCustomerAppLinkUpdated()
    }
    return url
  }, [token, customerId])

  const handleCopy = useCallback(async () => {
    setCopying(true)
    try {
      let url = shareUrl
      if (isCustomerApp) {
        url = await ensureCustomerAppUrl()
        setShareUrl(url)
      } else {
        url = url || resolveRegistrationUrl()
        setShareUrl(url)
      }
      if (!url) {
        const fail = isCustomerApp
          ? '고객앱 링크를 만들 수 없습니다.'
          : '고객등록 링크를 만들 수 없습니다.'
        onFeedback(fail)
        showStatus(fail, 'error')
        return
      }
      const ok = await copyTextToClipboard(url)
      if (!ok) {
        showStatus('복사에 실패했습니다. 다시 시도해 주세요.', 'error')
        onFeedback('복사에 실패했습니다. 다시 시도해 주세요.')
        return
      }
      const success = isCustomerApp
        ? '고객앱 링크를 복사했습니다.'
        : '고객등록 링크를 복사했습니다.'
      showStatus(success, 'success')
      onFeedback(success)
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : '복사에 실패했습니다. 다시 시도해 주세요.'
      showStatus(msg, 'error')
      onFeedback(msg)
    } finally {
      setCopying(false)
    }
  }, [
    shareUrl,
    isCustomerApp,
    ensureCustomerAppUrl,
    resolveRegistrationUrl,
    onFeedback,
    showStatus,
  ])

  const handleSms = useCallback(async () => {
    if (!token?.trim()) {
      onFeedback('로그인이 필요합니다.')
      return
    }
    if (!validReceiver) {
      showStatus(
        hasReceiverInput
          ? '올바른 휴대폰번호를 입력해 주세요.'
          : isCustomerApp
            ? MISSING_CUSTOMER_PHONE_REASON
            : '수신번호를 입력해 주세요.',
        'error',
      )
      return
    }
    if (!smsAvailable) {
      showStatus(smsDisabledReason, 'error')
      return
    }
    setSendingSms(true)
    try {
      if (isCustomerApp) {
        if (!customerId || customerId < 1) {
          showStatus('고객을 확인할 수 없습니다.', 'error')
          return
        }
        await sendCustomerAppSms(token, customerId, digitsOnly(receiver))
        showStatus('고객앱 링크 문자를 발송했습니다.', 'success')
        onFeedback('고객앱 링크 문자를 발송했습니다.')
        notifyCustomerAppLinkUpdated()
      } else {
        await sendCustomerRegistrationSms(token, digitsOnly(receiver))
        showStatus('고객등록 링크 문자를 발송했습니다.', 'success')
        onFeedback('고객등록 링크 문자를 발송했습니다.')
      }
    } catch (error) {
      const reason =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : '알 수 없는 오류'
      const msg = `문자 발송에 실패했습니다. 사유: ${reason}`
      showStatus(msg, 'error')
      onFeedback(msg)
    } finally {
      setSendingSms(false)
    }
  }, [
    token,
    validReceiver,
    hasReceiverInput,
    smsAvailable,
    smsDisabledReason,
    receiver,
    isCustomerApp,
    customerId,
    onFeedback,
    showStatus,
  ])

  const handleAlimtalk = useCallback(async () => {
    if (!token?.trim()) {
      onFeedback('로그인이 필요합니다.')
      return
    }
    if (!validReceiver) {
      showStatus(
        hasReceiverInput
          ? '올바른 휴대폰번호를 입력해 주세요.'
          : isCustomerApp
            ? MISSING_CUSTOMER_PHONE_REASON
            : '수신번호를 입력해 주세요.',
        'error',
      )
      return
    }
    setSendingAlimtalk(true)
    try {
      if (isCustomerApp) {
        if (!customerId || customerId < 1) {
          showStatus('고객을 확인할 수 없습니다.', 'error')
          return
        }
        const result = await sendCustomerAppAlimtalkShare(token, customerId, digitsOnly(receiver))
        if (result.status === 'dry_run') {
          const msg = '고객앱 링크 카카오톡 발송 테스트가 완료되었습니다.'
          showStatus(msg, 'success')
          onFeedback(msg)
        } else if (result.status === 'sent') {
          const msg = '고객앱 링크 카카오톡을 발송했습니다.'
          showStatus(msg, 'success')
          onFeedback(msg)
        } else if (result.status === 'blocked') {
          const msg =
            '템플릿 승인 전이라 실제 카카오톡 발송은 차단되었습니다. 링크 복사로 직접 전달할 수 있습니다.'
          showStatus(msg, 'info')
          onFeedback(msg)
        } else if (result.status === 'missing_receiver') {
          showStatus(MISSING_CUSTOMER_PHONE_REASON, 'error')
          onFeedback(MISSING_CUSTOMER_PHONE_REASON)
        } else {
          const reason = result.providerMessage ? String(result.providerMessage) : ''
          const msg = reason
            ? `카카오톡 발송에 실패했습니다. ${reason}`
            : '카카오톡 발송에 실패했습니다. 링크 복사로 직접 전달할 수 있습니다.'
          showStatus(msg, 'error')
          onFeedback(msg)
        }
        notifyCustomerAppLinkUpdated()
      } else {
        const result = await sendCustomerRegistrationAlimtalk(token, digitsOnly(receiver))
        if (result.status === 'dry_run') {
          const msg = '고객등록 카카오톡 발송 테스트가 완료되었습니다.'
          showStatus(msg, 'success')
          onFeedback(msg)
        } else if (result.status === 'sent') {
          const msg = '고객등록 링크 카카오톡을 발송했습니다.'
          showStatus(msg, 'success')
          onFeedback(msg)
        } else if (result.status === 'blocked') {
          const msg =
            '템플릿 승인 전이라 실제 카카오톡 발송은 차단되었습니다. 링크 복사로 직접 전달할 수 있습니다.'
          showStatus(msg, 'info')
          onFeedback(msg)
        } else {
          const reason = result.providerMessage ? String(result.providerMessage) : ''
          const msg = reason
            ? `카카오톡 발송에 실패했습니다. ${reason}`
            : '카카오톡 발송에 실패했습니다. 링크 복사로 직접 전달할 수 있습니다.'
          showStatus(msg, 'error')
          onFeedback(msg)
        }
      }
    } catch (error) {
      const providerMessage =
        error instanceof ApiError &&
        error.data &&
        typeof error.data === 'object' &&
        'providerMessage' in error.data &&
        error.data.providerMessage
          ? String(error.data.providerMessage)
          : ''
      const msg = providerMessage
        ? `카카오톡 발송에 실패했습니다. ${providerMessage}`
        : '카카오톡 발송에 실패했습니다. 링크 복사로 직접 전달할 수 있습니다.'
      showStatus(msg, 'error')
      onFeedback(
        error instanceof ApiError && error.message && !providerMessage
          ? `카카오톡 발송에 실패했습니다. 사유: ${error.message}`
          : msg,
      )
    } finally {
      setSendingAlimtalk(false)
    }
  }, [
    token,
    validReceiver,
    hasReceiverInput,
    receiver,
    isCustomerApp,
    customerId,
    onFeedback,
    showStatus,
  ])

  const title = isCustomerApp ? '고객앱 링크 보내기' : '고객등록 링크 보내기'
  const description = isCustomerApp
    ? '고객에게 고객앱 접속 링크를 문자 또는 카카오톡으로 보낼 수 있습니다. 발송이 어려운 경우 링크 복사로 직접 전달할 수 있습니다.'
    : '수신번호를 입력하면 고객정보 등록 링크를 문자 또는 카카오톡으로 보낼 수 있습니다. 발송이 어려운 경우 링크 복사로 직접 전달할 수 있습니다.'

  const phonePlaceholder =
    isCustomerApp && !isValidMobile(prefilledPhone)
      ? '고객 휴대폰번호 없음'
      : PHONE_INPUT_PLACEHOLDER

  const smsTitle = !validReceiver
    ? hasReceiverInput
      ? '올바른 휴대폰번호를 입력해 주세요.'
      : isCustomerApp
        ? MISSING_CUSTOMER_PHONE_REASON
        : '수신번호를 입력해 주세요.'
    : !smsAvailable
      ? smsDisabledReason
      : isCustomerApp
        ? '고객앱 링크를 문자로 발송합니다.'
        : '고객등록 링크를 문자로 발송합니다.'

  const copyDisabled = busy || (!isCustomerApp && !shareUrl && !resolveRegistrationUrl())

  const requestClose = useCallback(() => {
    if (busy) return
    onClose()
  }, [busy, onClose])

  /*
   * Android/브라우저 back → 모달만 닫기 (뒤 레이어 route 이동 금지).
   * 공용 useBackButtonClose: open 시 synthetic history 1회 push, popstate 시 onClose,
   * 버튼 닫기 시 cleanup 에서 marker 일치할 때만 history.back() 으로 entry 정리.
   * BaseDialog closeOnHistoryBack 과 이중 trap 하지 않는다.
   * back 은 busy 여부와 무관하게 닫는다(trap 소비 후 모달만 남는 회귀 방지).
   */
  useBackButtonClose(open, onClose)

  return (
    <BaseDialog
      open={open}
      onClose={requestClose}
      ariaLabel={title}
      closeOnBackdrop={false}
      closeOnEsc={false}
      usePortal
      panelClassName={[
        'customer-registration-share-dialog',
        // BaseDialog default(w-[90%] max-w-md p-4) 를 이기고 header/body/footer 셸 고정
        '!w-[min(560px,calc(100vw-32px))] !max-w-none !max-h-[calc(100dvh-32px)] !min-h-0 !flex !flex-col !overflow-hidden !p-0',
      ].join(' ')}
    >
      <div className="customer-registration-share-shell">
        <header className="customer-registration-share-modal__header">
          <h2 className="customer-registration-share-modal__title">{title}</h2>
          <button
            type="button"
            className="customer-registration-share-modal__close"
            disabled={busy}
            onClick={requestClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="customer-registration-share-modal__body">
          <div className="customer-registration-share-modal">
            <p className="customer-registration-share-modal__desc">{description}</p>

            <label className="customer-registration-share-modal__field">
              <span className="customer-registration-share-modal__label">수신번호</span>
              <FormInput
                format="phone"
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                disabled={busy}
                placeholder={phonePlaceholder}
                inputMode="numeric"
                autoComplete="tel"
              />
            </label>

            {customerPhoneMissing ? (
              <p className="customer-registration-share-modal__hint" role="note">
                {MISSING_CUSTOMER_PHONE_HINT}
              </p>
            ) : !smsAvailable ? (
              <p className="customer-registration-share-modal__hint" role="note">
                {smsDisabledReason}
              </p>
            ) : null}

            <section className="customer-registration-share-modal__actions" aria-label="발송 방법">
              <h3 className="customer-registration-share-modal__actions-title">발송 방법</h3>
              <div className="customer-registration-share-modal__action-grid">
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  fullWidth
                  loading={copying}
                  disabled={copyDisabled}
                  onClick={() => void handleCopy()}
                >
                  링크 복사
                </FormButton>
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  fullWidth
                  loading={sendingSms}
                  disabled={busy || !validReceiver || !smsAvailable}
                  title={smsTitle}
                  onClick={() => void handleSms()}
                >
                  문자 발송
                </FormButton>
                <FormButton
                  htmlType="button"
                  variant="secondary"
                  fullWidth
                  className="customer-registration-share-modal__kakao-btn"
                  loading={sendingAlimtalk}
                  disabled={busy || !validReceiver}
                  title={
                    validReceiver
                      ? '카카오 알림톡으로 발송합니다.'
                      : isCustomerApp
                        ? MISSING_CUSTOMER_PHONE_REASON
                        : '수신번호를 입력해 주세요.'
                  }
                  onClick={() => void handleAlimtalk()}
                >
                  카카오톡 발송
                </FormButton>
              </div>
            </section>

            <div
              className={`customer-registration-share-modal__status customer-registration-share-modal__status--${statusTone}${
                statusMessage ? ' is-visible' : ''
              }`}
              role="status"
              aria-live="polite"
            >
              {statusMessage || '\u00a0'}
            </div>
          </div>
        </div>

        <footer className="customer-registration-share-modal__footer">
          <FormButton
            htmlType="button"
            variant="secondary"
            fullWidth
            disabled={busy}
            onClick={requestClose}
          >
            취소
          </FormButton>
        </footer>
      </div>
    </BaseDialog>
  )
}
