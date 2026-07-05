import { formatKrMobileDisplay } from '../../smsDisplayUtils'
import type { SmsMessageMeta, SmsPreviewAttachment } from '../../utils/smsMessageMeta'

type Props = {
  meta: SmsMessageMeta
  senderNumber?: string
  attachment?: SmsPreviewAttachment
  transitionNotice?: string | null
  onDismissTransition?: () => void
  /** 좁은 패널(예약문자 등)에서 phone mockup 축소 */
  compact?: boolean
  /** 미리보기 캡션(제목·유형) 숨김 */
  hideCaption?: boolean
}

export default function SmsPhonePreview({
  meta,
  senderNumber,
  attachment,
  transitionNotice,
  onDismissTransition,
  compact = false,
  hideCaption = false,
}: Props) {
  const senderLabel = senderNumber ? formatKrMobileDisplay(senderNumber) : '발신번호 미선택'
  const messageText = meta.previewText.trim()
  const isEmpty = !messageText

  return (
    <aside
      className={`sms-composer__preview-panel sms-preview-panel${compact ? ' sms-preview-panel--compact' : ''}`}
      aria-label="휴대폰 미리보기"
    >
      {!hideCaption ? (
        <div className="sms-composer__preview-caption">
          <p className="sms-composer__preview-caption-title">미리보기</p>
          <p className="sms-composer__preview-caption-type">현재 유형: {meta.typeLabel}</p>
        </div>
      ) : null}

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

      <div className="sms-phone-preview-shell">
        <div className="sms-phone-preview">
          <div className="sms-phone-preview__top" aria-hidden="true">
            <span className="sms-phone-preview__speaker" />
            <span className="sms-phone-preview__camera" />
          </div>
          <div className="sms-phone-preview__header">문자</div>
          <div className="sms-phone-preview__number">{senderLabel}</div>
          <div className={`sms-phone-preview__body${isEmpty ? ' sms-phone-preview__body--empty' : ''}`}>
            {attachment ? (
              <div className="sms-phone-preview__attachment">
                <img
                  src={attachment.previewUrl}
                  alt={attachment.fileName || '첨부 이미지'}
                  className="sms-phone-preview__attachment-image"
                />
              </div>
            ) : null}
            {isEmpty ? '보낼 문자 내용을 입력해 주세요.' : messageText}
          </div>
        </div>
      </div>

      {!hideCaption ? (
        <p className="sms-composer__preview-disclaimer">
          실제 표시는 통신사와 기기에 따라 일부 다를 수 있습니다.
        </p>
      ) : null}
    </aside>
  )
}
