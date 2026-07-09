import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import { formatAutomationDayOffsetLabel } from '../../config/smsAutomationRule.config'
import type {
  SmsAutomationRulePreview,
  SmsAutomationRunDetail,
  SmsAutomationRunResult,
} from '../../types/smsAutomationRuleTypes'
import { SmsAutomationStatusBadge } from './SmsAutomationStatusBadge'

export type SmsAutomationRulePreviewProps = {
  preview: SmsAutomationRulePreview | null
  loading: boolean
  canPreview: boolean
  baseDate: string
  onBaseDateChange: (value: string) => void
  onLoadPreview: () => void
  runLoading?: boolean
  runResult?: SmsAutomationRunResult | null
  runDetail?: SmsAutomationRunDetail | null
  runDetailLoading?: boolean
  realSendEnabled?: boolean
  onRunSimulation?: () => void
  onRunRealSend?: () => void
  onLoadRunDetail?: (runId: number) => void
  onClearRunDetail?: () => void
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  return phone
}

function RunResultSummary({
  result,
  runDetail,
  runDetailLoading,
  onLoadRunDetail,
  onClearRunDetail,
}: {
  result: SmsAutomationRunResult
  runDetail?: SmsAutomationRunDetail | null
  runDetailLoading?: boolean
  onLoadRunDetail?: (runId: number) => void
  onClearRunDetail?: () => void
}) {
  const { summary } = result
  return (
    <div className="sms-automation-rules__run-result">
      <h3 className="sms-automation-rules__run-result-title">실행 결과</h3>
      <div className="sms-automation-rules__preview-summary-cards">
        <div className="sms-automation-rules__preview-summary-card">
          <span>실행 ID</span>
          <strong>{result.runId}</strong>
        </div>
        <div className="sms-automation-rules__preview-summary-card">
          <span>모드</span>
          <strong>{result.mode === 'REAL_SEND' ? '실제 발송' : '모의 실행'}</strong>
        </div>
        <div className="sms-automation-rules__preview-summary-card">
          <span>발송 가능</span>
          <strong>{summary.sendable}</strong>
        </div>
        <div className="sms-automation-rules__preview-summary-card sms-automation-rules__preview-summary-card--excluded">
          <span>제외</span>
          <strong>{summary.excluded}</strong>
        </div>
        <div className="sms-automation-rules__preview-summary-card sms-automation-rules__preview-summary-card--sendable">
          <span>성공/모의</span>
          <strong>{summary.sent + summary.simulated}</strong>
        </div>
        <div className="sms-automation-rules__preview-summary-card">
          <span>실패</span>
          <strong>{summary.failed}</strong>
        </div>
        <div className="sms-automation-rules__preview-summary-card">
          <span>중복 제외</span>
          <strong>{summary.skippedDuplicate}</strong>
        </div>
      </div>
      <div className="sms-automation-rules__run-result-actions">
        {runDetail ? (
          <FormButton htmlType="button" variant="secondary" onClick={onClearRunDetail}>
            상세 닫기
          </FormButton>
        ) : (
          <FormButton
            htmlType="button"
            variant="secondary"
            disabled={runDetailLoading}
            onClick={() => onLoadRunDetail?.(result.runId)}
          >
            {runDetailLoading ? '상세 불러오는 중…' : '실행 상세 보기'}
          </FormButton>
        )}
      </div>
      {runDetail ? (
        <div className="sms-automation-rules__run-detail-list-shell">
          <ul className="sms-automation-rules__preview-cards">
            {runDetail.items.map((item) => (
              <li key={item.id} className="sms-automation-rules__preview-card">
                <div className="sms-automation-rules__preview-card-header">
                  <strong>{item.customerName}</strong>
                  <span className="sms-automation-rules__sendable-badge">{item.sendStatus}</span>
                </div>
                <dl className="sms-automation-rules__preview-card-meta">
                  <div>
                    <dt>연락처</dt>
                    <dd>{item.phone ? formatPhoneDisplay(item.phone) : '—'}</dd>
                  </div>
                  <div>
                    <dt>기준 항목</dt>
                    <dd>{item.referenceTitle ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>기준일</dt>
                    <dd>{item.referenceDate ?? '—'}</dd>
                  </div>
                  {item.sendResultMessage ? (
                    <div className="sms-automation-rules__preview-card-reason">
                      <dt>결과</dt>
                      <dd>{item.sendResultMessage}</dd>
                    </div>
                  ) : null}
                  {item.excludedReason ? (
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
      ) : null}
    </div>
  )
}

export function SmsAutomationRulePreviewPanel({
  preview,
  loading,
  canPreview,
  baseDate,
  onBaseDateChange,
  onLoadPreview,
  runLoading = false,
  runResult = null,
  runDetail = null,
  runDetailLoading = false,
  realSendEnabled = false,
  onRunSimulation,
  onRunRealSend,
  onLoadRunDetail,
  onClearRunDetail,
}: SmsAutomationRulePreviewProps) {
  const sendableCount = preview?.summary.sendable ?? 0
  const excludedCount = preview?.summary.excluded ?? 0

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
              disabled={!canPreview || loading || runLoading}
              onChange={(e) => onBaseDateChange(e.target.value)}
            />
          </label>
          <FormButton
            htmlType="button"
            variant="secondary"
            disabled={!canPreview || loading || runLoading}
            onClick={onLoadPreview}
          >
            {loading ? '조회 중…' : '미리보기'}
          </FormButton>
          <FormButton
            htmlType="button"
            variant="secondary"
            disabled={!canPreview || loading || runLoading}
            onClick={onRunSimulation}
          >
            {runLoading ? '실행 중…' : '모의 실행'}
          </FormButton>
          <FormButton
            htmlType="button"
            variant="primary"
            disabled={!canPreview || loading || runLoading || !realSendEnabled}
            onClick={onRunRealSend}
          >
            실제 발송 실행
          </FormButton>
        </div>
      </div>

      {!realSendEnabled ? (
        <p className="sms-automation-rules__run-hint sms-automation-rules__run-hint--disabled">
          현재 실제 발송 비활성화 상태입니다. 모의 실행만 가능하며, 모의 실행은 중복 발송 기록을 남기지
          않습니다. (SMS_MODULE_REAL_SEND_ENABLED)
        </p>
      ) : (
        <p className="sms-automation-rules__run-hint">
          모의 실행은 실제 문자를 발송하지 않으며, 중복 발송 기록도 남기지 않습니다. 실제 발송 시 동일
          규칙·고객·기준일 문자는 중복 발송되지 않습니다.
        </p>
      )}

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
                <strong>{sendableCount}</strong>
              </div>
              <div className="sms-automation-rules__preview-summary-card sms-automation-rules__preview-summary-card--excluded">
                <span>제외</span>
                <strong>{excludedCount}</strong>
              </div>
            </div>
          </div>

          {runResult ? (
            <RunResultSummary
              result={runResult}
              runDetail={runDetail}
              runDetailLoading={runDetailLoading}
              onLoadRunDetail={onLoadRunDetail}
              onClearRunDetail={onClearRunDetail}
            />
          ) : null}

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
                      {item.scopeNote ? (
                        <div className="sms-automation-rules__preview-card-note">
                          <dt>참고</dt>
                          <dd>{item.scopeNote}</dd>
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
          기준일을 선택한 뒤 미리보기를 실행하세요. 미리보기는 실제 문자를 발송하지 않습니다.
        </p>
      )}
    </section>
  )
}
