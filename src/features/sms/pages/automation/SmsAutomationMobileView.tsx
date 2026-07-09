import { SmsAutomationPhonePreview } from '../../components/automation/SmsAutomationPhonePreview'
import { SmsAutomationRuleEditor } from '../../components/automation/SmsAutomationRuleEditor'
import { SmsAutomationRuleList } from '../../components/automation/SmsAutomationRuleList'
import { SmsAutomationRulePreviewPanel } from '../../components/automation/SmsAutomationRulePreview'
import { SmsAutomationSummaryCards } from '../../components/automation/SmsAutomationStatusBadge'
import { SmsModuleNav } from '../../components/SmsModuleNav'
import FormButton from '../../../../components/form/FormButton'
import type { SmsAutomationViewProps } from './SmsAutomationPCView'

function AlertBox({ error, notice }: { error: string | null; notice: string | null }) {
  if (error) {
    return <div className="sms-automation-rules__alert sms-automation-rules__alert--error">{error}</div>
  }
  if (notice) {
    return <div className="sms-automation-rules__alert sms-automation-rules__alert--success">{notice}</div>
  }
  return null
}

export default function SmsAutomationMobileView(props: SmsAutomationViewProps) {
  const showEditor = props.isCreating || props.selectedRuleId != null

  return (
    <main className="page sms-automation-rules-page sms-automation-rules-page--mobile page--with-back">
      <div className="sms-automation-rules-page__shell">
        <div className="sms-module__topbar sms-module__topbar--mobile">
          <SmsModuleNav variant="mobile" activeTab="automations" />
        </div>

        <header className="sms-automation-rules-page__header">
          <h1 className="sms-automation-rules-page__title">자동문자</h1>
        </header>

        <p className="sms-automation-rules-page__subtitle">
          고객 생일, 자동차보험 만기, 보험나이, 고객 지정 기념일 기준으로 자동 발송 규칙을 설정합니다.
        </p>

        <SmsAutomationSummaryCards rules={props.rules} />
        <AlertBox error={props.error} notice={props.notice} />

        {showEditor ? (
          <div className="sms-automation-rules-page__mobile-detail">
            <FormButton
              htmlType="button"
              variant="secondary"
              className="sms-automation-rules__back-to-list"
              onClick={() => props.selectRule(null)}
            >
              목록으로
            </FormButton>
            <SmsAutomationRuleEditor
              form={props.form}
              isCreating={props.isCreating}
              saving={props.saving}
              onChange={props.updateForm}
              onTriggerTypeChange={props.changeTriggerType}
              onSave={() => void props.saveForm()}
              onDelete={() => void props.removeSelected()}
            />
            <SmsAutomationPhonePreview
              form={props.form}
              preview={props.preview}
              baseDate={props.previewBaseDate}
              compact
            />
            <SmsAutomationRulePreviewPanel
              preview={props.preview}
              loading={props.previewLoading}
              canPreview={!props.isCreating && props.form.id != null}
              baseDate={props.previewBaseDate}
              onBaseDateChange={props.setPreviewBaseDate}
              onLoadPreview={() => void props.loadPreview()}
            />
          </div>
        ) : (
          <SmsAutomationRuleList
            rules={props.rules}
            selectedRuleId={props.selectedRuleId}
            loading={props.loading}
            onSelect={props.selectRule}
            onCreate={props.startCreate}
          />
        )}
      </div>
    </main>
  )
}
