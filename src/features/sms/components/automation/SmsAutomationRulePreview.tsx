import FormButton from '../../../../components/form/FormButton'
import type { SmsAutomationRulePreview } from '../../types/smsAutomationRuleTypes'

export type SmsAutomationRulePreviewProps = {
  preview: SmsAutomationRulePreview | null
  loading: boolean
  canPreview: boolean
  onLoadPreview: () => void
}

export function SmsAutomationRulePreviewPanel({
  preview,
  loading,
  canPreview,
  onLoadPreview,
}: SmsAutomationRulePreviewProps) {
  return (
    <section className="sms-automation-rules__preview-panel" aria-label="대상자 미리보기">
      <div className="sms-automation-rules__preview-header">
        <h2 className="sms-automation-rules__panel-title">대상자 미리보기</h2>
        <FormButton
          htmlType="button"
          variant="secondary"
          disabled={!canPreview || loading}
          onClick={onLoadPreview}
        >
          {loading ? '조회 중…' : '미리보기'}
        </FormButton>
      </div>
      {!canPreview ? (
        <p className="sms-automation-rules__muted">규칙을 저장한 뒤 미리보기를 사용할 수 있습니다.</p>
      ) : preview ? (
        <div className="sms-automation-rules__preview-body">
          <p className="sms-automation-rules__preview-message">{preview.message}</p>
          {preview.estimatedTargetCount != null ? (
            <p className="sms-automation-rules__muted">예상 대상: {preview.estimatedTargetCount}명</p>
          ) : null}
          {preview.sampleTargets.length > 0 ? (
            <ul className="sms-automation-rules__preview-list">
              {preview.sampleTargets.map((row, idx) => (
                <li key={`${row.customerId ?? idx}-${row.phone ?? ''}`}>
                  {row.customerName ?? '—'} · {row.phone ?? '—'}
                  {row.referenceDate ? ` · ${row.referenceDate}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="sms-automation-rules__muted">
          미리보기 버튼을 눌러 대상자 계산 구조를 확인하세요. (실제 발송은 하지 않습니다)
        </p>
      )}
    </section>
  )
}
