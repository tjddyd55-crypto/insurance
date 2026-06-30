import { SMS_BYTE_LIMIT } from '../../config/smsCompose.config'
import type { SmsMessageMeta } from '../../utils/smsMessageMeta'

type Props = {
  meta: SmsMessageMeta
}

export default function SmsMessageMetaBar({ meta }: Props) {
  const progress = meta.hasAttachment
    ? 100
    : Math.min(100, Math.round((meta.byteCount / SMS_BYTE_LIMIT) * 100))
  const progressWarn = !meta.hasAttachment && meta.messageType === 'SMS' && progress >= 80

  return (
    <div className="sms-composer__meta-bar">
      <p className="sms-composer__meta-inline">
        {meta.hasAttachment ? (
          <>
            이미지 첨부됨 · <strong>{meta.typeLabel}</strong>
          </>
        ) : meta.isOverSmsLimit ? (
          <>
            {meta.byteCount}byte · <strong>{meta.typeLabel}로 전환됨</strong>
          </>
        ) : (
          <>
            {meta.byteCount}byte / {SMS_BYTE_LIMIT}byte · <strong>{meta.typeLabel}</strong>
          </>
        )}
      </p>

      {!meta.hasAttachment ? (
        <div
          className={`sms-composer__progress sms-composer__progress--compact${progressWarn ? ' sms-composer__progress--warn' : ''}${meta.isOverSmsLimit ? ' sms-composer__progress--over' : ''}`}
        >
          <div className="sms-composer__progress-bar" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      <ul className="sms-composer__meta-notes">
        <li>한글은 2byte 기준으로 계산됩니다.</li>
        <li>줄바꿈과 수신거부 문구도 byte에 포함됩니다.</li>
        <li>byte 수는 알리고 기준에 맞춰 계산하며, 특수문자에 따라 일부 차이가 있을 수 있습니다.</li>
      </ul>
    </div>
  )
}
