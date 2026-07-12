import { formatKrMobileDisplay } from '../../smsDisplayUtils'
import type { SmsPhonePreviewProps } from './smsMessagePreview.types'
import { resolveSmsPhonePreviewMessage } from './smsMessagePreview.utils'

export function SmsPhonePreview({
  message,
  meta,
  senderNumber,
  headerLabel = '문자',
  emptyMessage = '보낼 문자 내용을 입력해 주세요.',
  attachment = null,
  transitionNotice,
  onDismissTransition,
  compact = false,
  hideCaption = false,
  showDescription = true,
  description = '실제 표시는 통신사와 기기에 따라 일부 다를 수 있습니다.',
  footer,
  className,
}: SmsPhonePreviewProps) {
  const resolved = resolveSmsPhonePreviewMessage({ message, meta, emptyMessage })
  const senderLabel = senderNumber ? formatKrMobileDisplay(senderNumber) : '발신번호 미선택'

  return (
    <aside
      className={`sms-composer__preview-panel sms-preview-panel${compact ? ' sms-preview-panel--compact' : ''}${className ? ` ${className}` : ''}`}
      aria-label="휴대폰 미리보기"
    >
      {!hideCaption ? (
        <div className="sms-composer__preview-caption">
          <p className="sms-composer__preview-caption-title">미리보기</p>
          <p className="sms-composer__preview-caption-type">현재 유형: {resolved.typeLabel}</p>
        </div>
      ) : null}

      {meta?.previewSubstitutionNotice ? (
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
        <span className="sms-phone-preview__speaker" aria-hidden="true" />
        <div className="sms-phone-preview">
          <div className="sms-phone-preview__header">{headerLabel}</div>
          <div className="sms-phone-preview__number">{senderLabel}</div>
          <div className={`sms-phone-preview__body${resolved.isEmpty ? ' sms-phone-preview__body--empty' : ''}`}>
            {attachment ? (
              <div className="sms-phone-preview__attachment">
                <img
                  src={attachment.previewUrl}
                  alt={attachment.fileName || '첨부 이미지'}
                  className="sms-phone-preview__attachment-image"
                />
              </div>
            ) : null}
            {resolved.isEmpty ? resolved.emptyMessage : resolved.text}
          </div>
          <div className="sms-phone-preview__bottom" aria-hidden="true">
            <span className="sms-phone-preview__home-indicator" />
          </div>
        </div>
      </div>

      {!hideCaption && showDescription ? (
        <p className="sms-composer__preview-disclaimer">{description}</p>
      ) : null}

      {footer}
    </aside>
  )
}

export default SmsPhonePreview
