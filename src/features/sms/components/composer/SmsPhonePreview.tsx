import { formatKrMobileDisplay } from '../../smsDisplayUtils'
import type { SmsMessageMeta, SmsPreviewAttachment } from '../../utils/smsMessageMeta'
import SmsMessageTypeBadge from './SmsMessageTypeBadge'

type Props = {
  meta: SmsMessageMeta
  senderNumber?: string
  attachment?: SmsPreviewAttachment
  transitionNotice?: string | null
  onDismissTransition?: () => void
}

export default function SmsPhonePreview({
  meta,
  senderNumber,
  attachment,
  transitionNotice,
  onDismissTransition,
}: Props) {
  const senderLabel = senderNumber ? formatKrMobileDisplay(senderNumber) : '발신번호 미선택'

  return (
    <aside className="sms-composer__preview-panel" aria-label="휴대폰 미리보기">
      {transitionNotice ? (
        <div className="sms-composer__preview-transition">
          <span>{transitionNotice}</span>
          {onDismissTransition ? (
            <button type="button" onClick={onDismissTransition}>
              닫기
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="sms-composer__phone">
        <div className="sms-composer__phone-sensors" aria-hidden="true">
          <span className="sms-composer__phone-speaker" />
          <span className="sms-composer__phone-camera" />
        </div>
        <div className="sms-composer__phone-header">
          <p className="sms-composer__phone-type">{meta.typeLabel}</p>
          <p className="sms-composer__phone-sender">{senderLabel}</p>
          <SmsMessageTypeBadge activeType={meta.messageType} pulse={Boolean(transitionNotice)} />
        </div>

        <div className="sms-composer__phone-screen">
          {attachment ? (
            <div className="sms-composer__phone-image-wrap">
              <img
                src={attachment.previewUrl}
                alt={attachment.fileName || '첨부 이미지'}
                className="sms-composer__phone-image"
              />
            </div>
          ) : null}

          <div className="sms-composer__phone-bubble">
            {meta.previewHeader ? (
              <p className="sms-composer__phone-ad-header">{meta.previewHeader}</p>
            ) : null}
            <p className="sms-composer__phone-body">
              {meta.previewBody || '보낼 문자 내용을 입력해 주세요.'}
            </p>
            {meta.previewFooter ? (
              <p className="sms-composer__phone-opt-out">{meta.previewFooter}</p>
            ) : null}
          </div>
        </div>

        <div className="sms-composer__phone-footer">
          <p>
            현재 {meta.byteCount} / {meta.limitByte}byte · {meta.typeLabel}
          </p>
          <p className="sms-composer__phone-disclaimer">
            실제 표시 형태는 통신사와 수신 기기에 따라 다를 수 있습니다.
          </p>
        </div>
      </div>
    </aside>
  )
}
