import { formatKrMobileDisplay } from '../../smsDisplayUtils'
import type { SmsMessageMeta, SmsPreviewAttachment } from '../../utils/smsMessageMeta'

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
  const messageText = meta.previewText.trim()
  const isEmpty = !messageText

  return (
    <aside className="sms-composer__preview-panel" aria-label="휴대폰 미리보기">
      <div className="sms-composer__preview-caption">
        <p className="sms-composer__preview-caption-title">미리보기</p>
        <p className="sms-composer__preview-caption-type">현재 유형: {meta.typeLabel}</p>
      </div>

      {meta.previewSubstitutionNotice ? (
        <p className="sms-composer__preview-hint">{meta.previewSubstitutionNotice}</p>
      ) : null}

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
          <p className="sms-composer__phone-app-title">문자</p>
          <p className="sms-composer__phone-sender">{senderLabel}</p>
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

          <p
            className={`sms-composer__phone-text${isEmpty ? ' sms-composer__phone-text--empty' : ''}`}
          >
            {isEmpty ? '보낼 문자 내용을 입력해 주세요.' : messageText}
          </p>
        </div>
      </div>

      <p className="sms-composer__preview-disclaimer">
        실제 표시는 통신사와 기기에 따라 일부 다를 수 있습니다.
      </p>
    </aside>
  )
}
