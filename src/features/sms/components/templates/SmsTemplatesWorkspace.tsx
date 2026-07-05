import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import type { SmsModuleViewProps } from '../../hooks/useSmsModuleState'
import SmsComposerLayout from '../composer/SmsComposerLayout'
import SmsTemplateListPanel from './SmsTemplateListPanel'

type Props = {
  variant: 'pc' | 'mobile'
  module: SmsModuleViewProps
  adDisplayName: string
}

export default function SmsTemplatesWorkspace({ variant, module, adDisplayName }: Props) {
  const {
    busy,
    settings,
    templates,
    templateForm,
    setTemplateForm,
    handleSaveTemplate,
    handleLoadTemplate,
    handleDeleteTemplate,
    handleUpdateTemplate,
  } = module

  const realSendEnabledFlag = Boolean(settings?.realSendEnabled)

  return (
    <div className={`sms-templates-workspace sms-templates-workspace--${variant}`}>
      <div className="sms-templates-workspace__head">
        <h2 className="sms-templates-workspace__title">템플릿 관리</h2>
        <p className="sms-module__muted">
          새 템플릿은 저장으로 등록하고, 불러오기는 작성 영역에만 복사됩니다. 수정은 기존 템플릿 PATCH로 저장됩니다.
        </p>
      </div>

      <SmsComposerLayout
        variant={variant}
        layout="templates"
        message={templateForm.message}
        onMessageChange={(message) => setTemplateForm((prev) => ({ ...prev, message }))}
        isAdvertisement={templateForm.messageType === 'ad'}
        onAdvertisementChange={(checked) =>
          setTemplateForm((prev) => ({ ...prev, messageType: checked ? 'ad' : 'info' }))
        }
        senderNumber={settings?.defaultSender}
        adDisplayName={adDisplayName}
        previewSubstitution={{ mode: 'preserve' }}
        realSendEnabled={realSendEnabledFlag}
        disabled={busy}
        setupFields={
          <label>
            템플릿명
            <FormInput
              value={templateForm.title}
              disabled={busy}
              placeholder="새 템플릿 이름"
              onChange={(e) => setTemplateForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>
        }
        actions={
          <FormButton
            type="button"
            disabled={busy || !templateForm.title.trim() || !templateForm.message.trim()}
            onClick={() => void handleSaveTemplate()}
          >
            템플릿 저장
          </FormButton>
        }
        below={
          <SmsTemplateListPanel
            templates={templates}
            busy={busy}
            onLoad={handleLoadTemplate}
            onDelete={handleDeleteTemplate}
            onUpdate={handleUpdateTemplate}
          />
        }
      />
    </div>
  )
}
