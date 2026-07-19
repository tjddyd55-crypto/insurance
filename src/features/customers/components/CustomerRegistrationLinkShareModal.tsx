import { useCallback, useEffect, useMemo, useState } from 'react'
import { FormButton, FormInput } from '../../../components/form'
import { FormDialog } from '../../../components/dialog'
import { ApiError } from '../../../lib/apiClient'
import { copyTextToClipboard } from '../../../lib/clipboard'
import { getPublicOrigin } from '../../../lib/publicOrigin'
import { buildCustomerRegistrationInviteUrl } from '../utils/buildCustomerRegistrationInviteUrl'
import {
  fetchCustomerRegistrationSmsAvailability,
  sendCustomerRegistrationAlimtalk,
  sendCustomerRegistrationSms,
} from '../api/customerRegistrationShareApi'

function digitsOnly(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '')
}

function isValidMobile(raw: string): boolean {
  return /^01[0-9]\d{7,8}$/.test(digitsOnly(raw))
}

type Props = {
  open: boolean
  token: string | null | undefined
  username: string
  gaCode: string
  onClose: () => void
  onFeedback: (message: string) => void
}

export default function CustomerRegistrationLinkShareModal({
  open,
  token,
  username,
  gaCode,
  onClose,
  onFeedback,
}: Props) {
  const [receiver, setReceiver] = useState('')
  const [registrationUrl, setRegistrationUrl] = useState('')
  const [smsAvailable, setSmsAvailable] = useState(false)
  const [smsDisabledReason, setSmsDisabledReason] = useState(
    '알리고 문자 설정이 완료된 경우에만 사용할 수 있습니다.',
  )
  const [copying, setCopying] = useState(false)
  const [sendingSms, setSendingSms] = useState(false)
  const [sendingAlimtalk, setSendingAlimtalk] = useState(false)
  const [localHint, setLocalHint] = useState('')

  const validReceiver = useMemo(() => isValidMobile(receiver), [receiver])
  const busy = copying || sendingSms || sendingAlimtalk

  const resolveUrl = useCallback(() => {
    const origin = getPublicOrigin()
    return buildCustomerRegistrationInviteUrl({
      origin,
      refUsername: username,
      gaCode,
    })
  }, [username, gaCode])

  useEffect(() => {
    if (!open) {
      return
    }
    setReceiver('')
    setLocalHint('')
    const url = resolveUrl()
    setRegistrationUrl(url)
  }, [open, resolveUrl])

  useEffect(() => {
    if (!open || !token?.trim()) {
      setSmsAvailable(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const avail = await fetchCustomerRegistrationSmsAvailability(token)
        if (cancelled) return
        setSmsAvailable(Boolean(avail.available))
        setSmsDisabledReason(
          avail.reason?.trim() || '알리고 문자 설정이 완료된 경우에만 사용할 수 있습니다.',
        )
      } catch {
        if (cancelled) return
        setSmsAvailable(false)
        setSmsDisabledReason('알리고 문자 설정이 완료된 경우에만 사용할 수 있습니다.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, token])

  const handleCopy = useCallback(async () => {
    const url = registrationUrl || resolveUrl()
    if (!url) {
      onFeedback('고객등록 링크를 만들 수 없습니다.')
      return
    }
    setCopying(true)
    setLocalHint('')
    try {
      const ok = await copyTextToClipboard(url)
      if (!ok) {
        setLocalHint('복사에 실패했습니다. 다시 시도해 주세요.')
        onFeedback('복사에 실패했습니다. 다시 시도해 주세요.')
        return
      }
      setLocalHint('고객등록 링크를 복사했습니다.')
      onFeedback('고객등록 링크를 복사했습니다.')
    } finally {
      setCopying(false)
    }
  }, [registrationUrl, resolveUrl, onFeedback])

  const handleSms = useCallback(async () => {
    if (!token?.trim()) {
      onFeedback('로그인이 필요합니다.')
      return
    }
    if (!validReceiver) {
      setLocalHint('수신번호를 입력해 주세요.')
      return
    }
    if (!smsAvailable) {
      setLocalHint(smsDisabledReason)
      return
    }
    setSendingSms(true)
    setLocalHint('')
    try {
      await sendCustomerRegistrationSms(token, digitsOnly(receiver))
      setLocalHint('고객등록 링크 문자를 발송했습니다.')
      onFeedback('고객등록 링크 문자를 발송했습니다.')
    } catch (error) {
      const reason =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : '알 수 없는 오류'
      const msg = `문자 발송에 실패했습니다. 사유: ${reason}`
      setLocalHint(msg)
      onFeedback(msg)
    } finally {
      setSendingSms(false)
    }
  }, [token, validReceiver, smsAvailable, smsDisabledReason, receiver, onFeedback])

  const handleAlimtalk = useCallback(async () => {
    if (!token?.trim()) {
      onFeedback('로그인이 필요합니다.')
      return
    }
    if (!validReceiver) {
      setLocalHint('수신번호를 입력해 주세요.')
      return
    }
    setSendingAlimtalk(true)
    setLocalHint('')
    try {
      const result = await sendCustomerRegistrationAlimtalk(token, digitsOnly(receiver))
      if (result.status === 'dry_run') {
        const msg = '고객등록 카카오톡 발송 테스트가 완료되었습니다.'
        setLocalHint(msg)
        onFeedback(msg)
      } else if (result.status === 'sent') {
        const msg = '고객등록 링크 카카오톡을 발송했습니다.'
        setLocalHint(msg)
        onFeedback(msg)
      } else if (result.status === 'blocked') {
        const msg =
          '템플릿 승인 전이라 실제 카카오톡 발송은 차단되었습니다. 링크 복사로 직접 전달할 수 있습니다.'
        setLocalHint(msg)
        onFeedback(msg)
      } else {
        const msg =
          '카카오톡 발송에 실패했습니다. 링크 복사로 직접 전달할 수 있습니다.'
        setLocalHint(msg)
        onFeedback(msg)
      }
    } catch (error) {
      const msg =
        '카카오톡 발송에 실패했습니다. 링크 복사로 직접 전달할 수 있습니다.'
      setLocalHint(msg)
      onFeedback(
        error instanceof ApiError && error.message
          ? `카카오톡 발송에 실패했습니다. 사유: ${error.message}`
          : msg,
      )
    } finally {
      setSendingAlimtalk(false)
    }
  }, [token, validReceiver, receiver, onFeedback])

  const smsTitle = !validReceiver
    ? '수신번호를 입력해 주세요.'
    : !smsAvailable
      ? smsDisabledReason
      : '고객등록 링크를 문자로 발송합니다.'

  return (
    <FormDialog
      open={open}
      onClose={() => {
        if (busy) return
        onClose()
      }}
      title="고객등록 링크 보내기"
      panelPreset="largeForm"
      footer={
        <div className="customer-registration-share-modal__footer">
          <FormButton
            htmlType="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            취소
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            loading={copying}
            disabled={busy || !registrationUrl}
            onClick={() => void handleCopy()}
          >
            링크 복사
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            loading={sendingSms}
            disabled={busy || !validReceiver || !smsAvailable}
            title={smsTitle}
            onClick={() => void handleSms()}
          >
            문자 발송
          </FormButton>
          <FormButton
            htmlType="button"
            variant="primary"
            loading={sendingAlimtalk}
            disabled={busy || !validReceiver}
            title={validReceiver ? '카카오 알림톡으로 발송합니다.' : '수신번호를 입력해 주세요.'}
            onClick={() => void handleAlimtalk()}
          >
            카카오톡 발송
          </FormButton>
        </div>
      }
    >
      <div className="customer-registration-share-modal">
        <p className="customer-registration-share-modal__desc">
          수신번호를 입력하면 고객정보 등록 링크를 문자 또는 카카오톡으로 보낼 수 있습니다.
          카카오톡이나 문자 발송이 어려운 경우 링크 복사로 직접 전달할 수 있습니다.
        </p>
        <label className="customer-registration-share-modal__field">
          <span className="customer-registration-share-modal__label">수신번호</span>
          <FormInput
            format="phone"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
            disabled={busy}
          />
        </label>
        {!smsAvailable ? (
          <p className="customer-registration-share-modal__hint" role="note">
            {smsDisabledReason}
          </p>
        ) : null}
        {localHint ? (
          <p className="customer-registration-share-modal__result" role="status">
            {localHint}
          </p>
        ) : null}
      </div>
    </FormDialog>
  )
}
