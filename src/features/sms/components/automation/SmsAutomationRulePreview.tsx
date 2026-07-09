import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import { formatAutomationDayOffsetLabel } from '../../config/smsAutomationRule.config'
import type { SmsAutomationRulePreview } from '../../types/smsAutomationRuleTypes'
import { SmsAutomationStatusBadge } from './SmsAutomationStatusBadge'

export type SmsAutomationRulePreviewProps = {
  preview: SmsAutomationRulePreview | null
  loading: boolean
  canPreview: boolean
  baseDate: string
  onBaseDateChange: (value: string) => void
  onLoadPreview: () => void
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  return phone
}

export function SmsAutomationRulePreviewPanel({
  preview,
  loading,
  canPreview,
  baseDate,
  onBaseDateChange,
  onLoadPreview,
}: SmsAutomationRulePreviewProps) {
  return (
    <section className="sms-automation-rules__preview-panel" aria-label="대상자 미리보기">
      <div className="sms-automation-rules__preview-header">
        <h2 className="sms-automation-rules__panel-title">대상자 미리보기</h2>
        <div className="sms-automation-rules__preview-controls">
          <label className="sms-automation-rules__preview-date-field">
            <span className="sms-automation-rules__label">기준일</span>
            <FormInput
              className="sms-automation-rules__control sms-automation-rules__control--narrow"
              type="date"
              value={baseDate}
              disabled={!canPreview || loading}
              onChange={(e) => onBaseDateChange(e.target.value)}
            />
          </label>
          <FormButton
            htmlType="button"
            variant="secondary"
            disabled={!canPreview || loading}
            onClick={onLoadPreview}
          >
            {loading ? '조회 중…' : '미리보기'}
          </FormButton>
        </div>
      </div>

      {!canPreview ? (
        <p className="sms-automation-rules__muted">규칙을 저장한 뒤 미리보기를 사용할 수 있습니다.</p>
      ) : preview?.previewAvailable ? (
        <div className="sms-automation-rules__preview-body">
          <div className="sms-automation-rules__preview-summary">
            <div className="sms-automation-rules__preview-summary-row">
              <span>기준일 {preview.baseDate}</span>
              <span>대상 기준일 {preview.targetDate}</span>
              <span>{formatAutomationDayOffsetLabel(preview.rule.dayOffset)}</span>
              <SmsAutomationStatusBadge isActive={preview.rule.isActive} />
            </div>
            <div className="sms-automation-rules__preview-summary-cards">
              <div className="sms-automation-rules__preview-summary-card">
                <span>전체 대상</span>
                <strong>{preview.summary.total}</strong>
              </div>
              <div className="sms-automation-rules__preview-summary-card sms-automation-rules__preview-summary-card--sendable">
                <span>발송 가능</span>
                <strong>{preview.summary.sendable}</strong>
              </div>
              <div className="sms-automation-rules__preview-summary-card sms-automation-rules__preview-summary-card--excluded">
                <span>제외</span>
                <strong>{preview.summary.excluded}</strong>
              </div>
            </div>
          </div>

          {preview.items.length === 0 ? (
            <p className="sms-automation-rules__muted">선택한 기준일에 해당하는 대상자가 없습니다.</p>
          ) : (
            <div className="sms-automation-rules__preview-list-shell">
              <ul className="sms-automation-rules__preview-cards">
                {preview.items.map((item, index) => (
                  <li key={`${item.customerId}-${item.phone}-${index}`} className="sms-automation-rules__preview-card">
                    <div className="sms-automation-rules__preview-card-header">
                      <strong>{item.customerName}</strong>
                      <span
                        className={`sms-automation-rules__sendable-badge${
                          item.sendable
                            ? ' sms-automation-rules__sendable-badge--ok'
                            : ' sms-automation-rules__sendable-badge--blocked'
                        }`}
                      >
                        {item.sendable ? '발송 가능' : '제외'}
                      </span>
                    </div>
                    <dl className="sms-automation-rules__preview-card-meta">
                      <div>
                        <dt>연락처</dt>
                        <dd>{item.phone ? formatPhoneDisplay(item.phone) : '—'}</dd>
                      </div>
                      <div>
                        <dt>기준 항목</dt>
                        <dd>{item.referenceTitle ?? item.triggerLabel}</dd>
                      </div>
                      <div>
                        <dt>기준일</dt>
                        <dd>{item.referenceDate ?? preview.targetDate}</dd>
                      </div>
                      <div>
                        <dt>D-day</dt>
                        <dd>{formatAutomationDayOffsetLabel(item.dayOffset)}</dd>
                      </div>
                      {item.carNumber ? (
                        <div>
                          <dt>차량번호</dt>
                          <dd>{item.carNumber}</dd>
                        </div>
                      ) : null}
                      {!item.sendable && item.excludedReason ? (
                        <div className="sms-automation-rules__preview-card-reason">
                          <dt>제외 사유</dt>
                          <dd>{item.excludedReason}</dd>
                        </div>
                      ) : null}
                    </dl>
                    <p className="sms-automation-rules__preview-card-message">{item.messageBody}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="sms-automation-rules__muted">
          기준일을 선택한 뒤 미리보기를 실행하세요. 실제 문자는 발송되지 않습니다.
        </p>
      )}
    </section>
  )
}
