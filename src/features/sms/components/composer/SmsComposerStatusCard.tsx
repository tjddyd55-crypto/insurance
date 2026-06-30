import { SMS_BYTE_LIMIT } from '../../config/smsCompose.config'
import type { SmsMessageMeta } from '../../utils/smsMessageMeta'
import SmsMessageTypeBadge from './SmsMessageTypeBadge'

type Props = {
  meta: SmsMessageMeta
  realSendEnabled: boolean
  balanceText?: string | null
  transitionNotice?: string | null
  onDismissTransition?: () => void
}

export default function SmsComposerStatusCard({
  meta,
  realSendEnabled,
  balanceText,
  transitionNotice,
  onDismissTransition,
}: Props) {
  const progress = meta.hasAttachment
    ? 100
    : Math.min(100, Math.round((meta.byteCount / SMS_BYTE_LIMIT) * 100))
  const progressWarn = !meta.hasAttachment && meta.messageType === 'SMS' && progress >= 80

  return (
    <section className="sms-composer__status-card" aria-label="문자 발송 상태">
      <div className="sms-composer__status-main">
        <div>
          <p className="sms-composer__status-title">
            현재 발송 유형: <strong>{meta.typeLabel}</strong>
          </p>
          <p className="sms-composer__status-byte">
            {meta.hasAttachment ? (
              <>이미지 첨부됨 · {meta.typeLabel}</>
            ) : (
              <>
                현재 {meta.byteCount} / {SMS_BYTE_LIMIT}byte
              </>
            )}
          </p>
          {meta.hasOptOut ? <p className="sms-composer__status-flag">수신거부 문구 포함</p> : null}
          {!realSendEnabled ? (
            <p className="sms-composer__status-flag sms-composer__status-flag--warn">
              실제 발송 비활성 상태
            </p>
          ) : null}
        </div>
        <SmsMessageTypeBadge activeType={meta.messageType} pulse={Boolean(transitionNotice)} />
      </div>

      {!meta.hasAttachment ? (
        <div
          className={`sms-composer__progress${progressWarn ? ' sms-composer__progress--warn' : ''}${meta.isOverSmsLimit ? ' sms-composer__progress--over' : ''}`}
          aria-hidden="true"
        >
          <div className="sms-composer__progress-bar" style={{ width: `${progress}%` }} />
        </div>
      ) : null}

      {transitionNotice ? (
        <div className="sms-composer__transition-banner">
          <span>{transitionNotice}</span>
          {onDismissTransition ? (
            <button type="button" className="sms-composer__transition-dismiss" onClick={onDismissTransition}>
              닫기
            </button>
          ) : null}
        </div>
      ) : null}

      <ul className="sms-composer__status-hints">
        <li>{SMS_BYTE_LIMIT}byte 초과 시 장문(LMS)로 전환됩니다.</li>
        <li>이미지 첨부 시 그림(MMS)로 전환됩니다.</li>
        {!realSendEnabled ? (
          <li>실제 문자 발송은 아직 활성화되어 있지 않습니다. 미리보기와 저장만 가능합니다.</li>
        ) : null}
      </ul>

      <div className="sms-composer__balance-strip">
        <p className="sms-composer__balance-label">잔액</p>
        {balanceText ? (
          <p className="sms-composer__balance-value">{balanceText}</p>
        ) : (
          <p className="sms-composer__balance-value sms-composer__balance-value--muted">
            잔액을 확인할 수 없습니다. 문자 설정에서 조회해 주세요.
          </p>
        )}
        <p className="sms-composer__deduction">
          현재 메시지는 <strong>{meta.deductionLabel}</strong>으로 차감됩니다.
        </p>
      </div>
    </section>
  )
}
