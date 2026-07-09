import { Link } from 'react-router-dom'
import { SmsAutomationRuleEditor } from '../../components/automation/SmsAutomationRuleEditor'
import { SmsAutomationRuleList } from '../../components/automation/SmsAutomationRuleList'
import { SmsAutomationRulePreviewPanel } from '../../components/automation/SmsAutomationRulePreview'
import { SmsManagementNav } from '../../components/SmsManagementNav'
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
        <header className="sms-automation-rules-page__header">
          <h1 className="sms-automation-rules-page__title">자동문자</h1>
          <Link className="sms-automation-rules-page__back-link" to="/sms/settings">
            문자 설정
          </Link>
        </header>

        <SmsManagementNav />
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
            <SmsAutomationRulePreviewPanel
              preview={props.preview}
              loading={props.previewLoading}
              canPreview={!props.isCreating && props.form.id != null}
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
