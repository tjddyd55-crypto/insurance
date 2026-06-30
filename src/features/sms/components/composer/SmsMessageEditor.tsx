import { useCallback, useRef, type ReactNode } from 'react'
import { SMS_AD_OPT_OUT_NUMBER, SMS_MMS_ATTACHMENT_UI_ENABLED } from '../../config/smsCompose.config'
import type { SmsMessageMeta, SmsPreviewAttachment } from '../../utils/smsMessageMeta'
import SmsMessageMetaBar from './SmsMessageMetaBar'
import SmsVariableChips from './SmsVariableChips'

type Props = {
  message: string
  onMessageChange: (value: string) => void
  meta: SmsMessageMeta
  isAdvertisement: boolean
  onAdvertisementChange: (value: boolean) => void
  attachment: SmsPreviewAttachment
  disabled?: boolean
  footer?: ReactNode
}

export default function SmsMessageEditor({
  message,
  onMessageChange,
  meta,
  isAdvertisement,
  onAdvertisementChange,
  attachment,
  disabled = false,
  footer,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const insertToken = useCallback(
    (token: string) => {
      const el = textareaRef.current
      if (!el) {
        onMessageChange(`${message}${token}`)
        return
      }
      const start = el.selectionStart ?? message.length
      const end = el.selectionEnd ?? message.length
      const next = `${message.slice(0, start)}${token}${message.slice(end)}`
      onMessageChange(next)
      requestAnimationFrame(() => {
        el.focus()
        const cursor = start + token.length
        el.setSelectionRange(cursor, cursor)
      })
    },
    [message, onMessageChange],
  )

  return (
    <section className="sms-composer__card">
      <h3 className="sms-composer__card-title">문자 작성</h3>

      <label className="sms-composer__editor-label">
        메시지 본문
        <textarea
          ref={textareaRef}
          className="sms-module__textarea sms-composer__textarea"
          rows={10}
          value={message}
          disabled={disabled}
          placeholder="보낼 문자 내용을 입력해 주세요."
          onChange={(e) => onMessageChange(e.target.value)}
        />
      </label>

      <SmsMessageMetaBar meta={meta} />
      <p className="sms-composer__wrap-hint">
        실제 줄바꿈은 오른쪽 휴대폰 미리보기 기준으로 확인해 주세요.
      </p>
      <SmsVariableChips onInsert={insertToken} disabled={disabled} />

      <div className="sms-composer__ad-panel">
        <label className="sms-composer__checkbox">
          <input
            type="checkbox"
            checked={isAdvertisement}
            disabled={disabled}
            onChange={(e) => onAdvertisementChange(e.target.checked)}
          />
          <span>광고성 문자입니다.</span>
        </label>
        <p className="sms-composer__ad-note">
          {isAdvertisement
            ? `(광고) 표시와 무료거부 ${SMS_AD_OPT_OUT_NUMBER} 문구가 미리보기·byte 계산에 포함됩니다.`
            : '광고성 문자가 아니면 본문만 표시됩니다.'}
        </p>
      </div>

      <div className="sms-composer__attachment">
        <p className="sms-composer__attachment-title">이미지 첨부</p>
        {SMS_MMS_ATTACHMENT_UI_ENABLED ? (
          <p className="sms-module__muted">이미지 첨부 시 그림(MMS)로 발송 유형이 변경됩니다.</p>
        ) : (
          <p className="sms-composer__attachment-disabled">
            MMS 발송은 후속 작업 예정입니다. 현재는 이미지 첨부 UI를 제공하지 않습니다.
          </p>
        )}
        {attachment ? (
          <div className="sms-composer__attachment-current">
            <span>{attachment.fileName}</span>
          </div>
        ) : null}
      </div>

      {footer ? <div className="sms-composer__editor-actions">{footer}</div> : null}
    </section>
  )
}
