import { Link } from 'react-router-dom'
import { SmsAutomationRuleEditor } from '../../components/automation/SmsAutomationRuleEditor'
import { SmsAutomationRuleList } from '../../components/automation/SmsAutomationRuleList'
import { SmsAutomationRulePreviewPanel } from '../../components/automation/SmsAutomationRulePreview'
import { SmsManagementNav } from '../../components/SmsManagementNav'
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
        <header className="sms-automation-rules-page__header">
          <div>
            <h1 className="sms-automation-rules-page__title">자동문자</h1>
            <p className="sms-automation-rules-page__subtitle">
              자동 발송 규칙을 설정합니다. 실제 문자 발송은 다음 단계에서 연결됩니다.
            </p>
          </div>
          <Link className="sms-automation-rules-page__back-link" to="/sms/settings">
            문자 설정으로
          </Link>
        </header>

        <SmsManagementNav />
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
              <>
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
              </>
            ) : (
              <div className="sms-automation-rules__empty-detail">
                <p>좌측에서 규칙을 선택하거나 새 규칙을 추가하세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
