import { SMS_BYTE_LIMIT } from '../../config/smsCompose.config'
import type { SmsMessageMeta } from '../../utils/smsMessageMeta'
import SmsMessageTypeBadge from './SmsMessageTypeBadge'

type Props = {
  meta: SmsMessageMeta
  realSendEnabled: boolean
  transitionNotice?: string | null
  onDismissTransition?: () => void
}

export default function SmsMessageMetaBar({
  meta,
  realSendEnabled,
  transitionNotice,
  onDismissTransition,
}: Props) {
  const progress = meta.hasAttachment
    ? 100
    : Math.min(100, Math.round((meta.byteCount / SMS_BYTE_LIMIT) * 100))
  const progressWarn = !meta.hasAttachment && meta.messageType === 'SMS' && progress >= 80

  return (
    <div className="sms-composer__meta-bar">
      <div className="sms-composer__meta-top">
        <p className="sms-composer__meta-inline">
          {meta.hasAttachment ? (
            <>
              이미지 첨부됨 · <strong>{meta.typeLabel}</strong>
            </>
          ) : meta.isOverSmsLimit ? (
            <>
              현재 {meta.byteCount}byte · <strong>{meta.typeLabel}</strong>
            </>
          ) : (
            <>
              현재 {meta.byteCount}byte · <strong>{meta.typeLabel}</strong>
            </>
          )}
        </p>
        <SmsMessageTypeBadge activeType={meta.messageType} compact pulse={Boolean(transitionNotice)} />
      </div>

      {!meta.hasAttachment ? (
        <div
          className={`sms-composer__progress sms-composer__progress--compact${progressWarn ? ' sms-composer__progress--warn' : ''}${meta.isOverSmsLimit ? ' sms-composer__progress--over' : ''}`}
          aria-hidden="true"
        >
          <div className="sms-composer__progress-bar" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      {transitionNotice ? (
        <div className="sms-composer__meta-transition">
          <span>{transitionNotice}</span>
          {onDismissTransition ? (
            <button type="button" className="sms-composer__transition-dismiss" onClick={onDismissTransition}>
              닫기
            </button>
          ) : null}
        </div>
      ) : null}

      <ul className="sms-composer__meta-notes">
        <li>{SMS_BYTE_LIMIT}byte 초과 시 장문(LMS)로 전환됩니다.</li>
        {meta.hasVariables ? (
          <li>변수 치환 후 고객 정보에 따라 실제 문자 용량과 SMS/LMS 구분이 달라질 수 있습니다.</li>
        ) : null}
        {!realSendEnabled ? <li>실제 발송은 비활성화 상태입니다.</li> : null}
      </ul>
    </div>
  )
}
