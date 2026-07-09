import { SmsAutomationPhonePreview } from '../../components/automation/SmsAutomationPhonePreview'
import { SmsAutomationRuleEditor } from '../../components/automation/SmsAutomationRuleEditor'
import { SmsAutomationRuleList } from '../../components/automation/SmsAutomationRuleList'
import { SmsAutomationRulePreviewPanel } from '../../components/automation/SmsAutomationRulePreview'
import { SmsAutomationSummaryCards } from '../../components/automation/SmsAutomationStatusBadge'
import { SmsModuleNav } from '../../components/SmsModuleNav'
import type { UseSmsAutomationRulesStateResult } from '../../hooks/useSmsAutomationRulesState'

export type SmsAutomationViewProps = UseSmsAutomationRulesStateResult

function AlertBox({ error, notice }: { error: string | null; notice: string | null }) {
  if (error) {
    return <div className="sms-automation-rules__alert sms-automation-rules__alert--error">{error}</div>
  }
  if (notice) {
    return <div className="sms-automation-rules__alert sms-automation-rules__alert--success">{notice}</div>
  }
  return null
}

export default function SmsAutomationPCView(props: SmsAutomationViewProps) {
  const showEditor = props.isCreating || props.selectedRuleId != null

  return (
    <main className="page sms-automation-rules-page sms-automation-rules-page--pc page--with-back">
      <div className="sms-automation-rules-page__shell">
        <div className="sms-module__topbar sms-module__topbar--pc">
          <SmsModuleNav variant="pc" activeTab="automations" />
        </div>

        <header className="sms-automation-rules-page__header">
          <div>
            <h1 className="sms-automation-rules-page__title">자동문자</h1>
            <p className="sms-automation-rules-page__subtitle">
              고객 생일, 자동차보험 만기, 보험나이, 고객 지정 기념일 기준으로 자동 발송 규칙을 설정합니다.
            </p>
          </div>
        </header>

        <SmsAutomationSummaryCards rules={props.rules} />
        <AlertBox error={props.error} notice={props.notice} />

        <div className="sms-automation-rules-page__layout sms-automation-rules-page__layout--pc">
          <SmsAutomationRuleList
            rules={props.rules}
            selectedRuleId={props.selectedRuleId}
            loading={props.loading}
            onSelect={props.selectRule}
            onCreate={props.startCreate}
          />
          <div className="sms-automation-rules-page__detail">
            {showEditor ? (
              <SmsAutomationRuleEditor
                form={props.form}
                isCreating={props.isCreating}
                saving={props.saving}
                onChange={props.updateForm}
                onTriggerTypeChange={props.changeTriggerType}
                onSave={() => void props.saveForm()}
                onDelete={() => void props.removeSelected()}
              />
            ) : (
              <div className="sms-automation-rules__empty-detail">
                <p>좌측에서 규칙을 선택하거나 새 규칙을 추가하세요.</p>
              </div>
            )}
          </div>
          {showEditor ? (
            <SmsAutomationPhonePreview
              form={props.form}
              preview={props.preview}
              baseDate={props.previewBaseDate}
            />
          ) : (
            <aside className="sms-automation-rules__phone-preview-panel sms-automation-rules__phone-preview-panel--placeholder">
              <h2 className="sms-automation-rules__panel-title">휴대폰 미리보기</h2>
              <p className="sms-automation-rules__muted">규칙을 선택하면 문자 예시가 표시됩니다.</p>
            </aside>
          )}
        </div>

        {showEditor ? (
          <SmsAutomationRulePreviewPanel
            preview={props.preview}
            loading={props.previewLoading}
            canPreview={!props.isCreating && props.form.id != null}
            baseDate={props.previewBaseDate}
            onBaseDateChange={props.setPreviewBaseDate}
            onLoadPreview={() => void props.loadPreview()}
          />
        ) : null}
      </div>
    </main>
  )
}
