import { useCallback, useState } from 'react'
import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import { useSmsMessageComposeMeta } from '../../hooks/useSmsMessageComposeMeta'
import type { SmsModuleViewProps } from '../../hooks/useSmsModuleState'
import type { SmsTemplate } from '../../types/sms.types'
import SmsMessageMetaBar from '../composer/SmsMessageMetaBar'
import SmsPhonePreview from '../composer/SmsPhonePreview'
import SmsVariableChips from '../composer/SmsVariableChips'
import SmsTemplateListPanel from './SmsTemplateListPanel'

type Props = {
  variant: 'pc' | 'mobile'
  module: SmsModuleViewProps
  adDisplayName: string
}

const EMPTY_FORM = {
  title: '',
  message: '',
  messageType: 'info' as 'info' | 'ad',
}

export default function SmsTemplatesWorkspace({ variant, module, adDisplayName }: Props) {
  const {
    busy,
    settings,
    templates,
    templateForm,
    setTemplateForm,
    handleSaveTemplate,
    handleDeleteTemplate,
    handleUpdateTemplate,
    navigateToSend,
  } = module

  const [loadedId, setLoadedId] = useState<number | null>(null)
  const realSendEnabledFlag = Boolean(settings?.realSendEnabled)

  const { meta, transitionNotice, dismissTransitionNotice } = useSmsMessageComposeMeta({
    body: templateForm.message,
    isAdvertisement: templateForm.messageType === 'ad',
    adDisplayName,
    previewSubstitution: { mode: 'preserve' },
  })

  const resetForm = useCallback(() => {
    setLoadedId(null)
    setTemplateForm({ ...EMPTY_FORM, imageAttachment: null })
  }, [setTemplateForm])

  const handleLoad = useCallback(
    (template: SmsTemplate) => {
      setLoadedId(template.id)
      setTemplateForm({
        title: template.title,
        message: template.message,
        messageType: template.messageType,
        imageAttachment: null,
      })
    },
    [setTemplateForm],
  )

  const handleDelete = useCallback(
    async (id: number) => {
      await handleDeleteTemplate(id)
      if (loadedId === id) {
        resetForm()
      }
    },
    [handleDeleteTemplate, loadedId, resetForm],
  )

  const insertToken = useCallback(
    (token: string) => {
      setTemplateForm((prev) => ({ ...prev, message: `${prev.message}${token}` }))
    },
    [setTemplateForm],
  )

  const handleSave = async () => {
    const title = templateForm.title.trim()
    const message = templateForm.message.trim()
    if (!title || !message) {
      return
    }
    if (loadedId != null) {
      await handleUpdateTemplate(loadedId, {
        title,
        message,
        messageType: templateForm.messageType,
      })
      resetForm()
      return
    }
    await handleSaveTemplate()
  }

  return (
    <div className={`sms-templates-workspace sms-templates-workspace--${variant}`}>
      <header className="sms-templates-workspace__head">
        <div className="sms-templates-workspace__head-main">
          <h2 className="sms-templates-workspace__title">문자 템플릿 관리</h2>
          <p className="sms-module__muted">
            자주 사용하는 문자 내용을 저장하고, 문자 발송 화면에서 불러올 수 있습니다.
          </p>
        </div>
        <FormButton type="button" variant="secondary" disabled={busy} onClick={() => navigateToSend()}>
          문자발송으로 돌아가기
        </FormButton>
      </header>

      <div className="sms-templates-workspace__grid">
        <section className="sms-composer__card sms-templates-workspace__form">
          <h3 className="sms-composer__card-title">템플릿 작성</h3>

          <label>
            템플릿명
            <FormInput
              value={templateForm.title}
              disabled={busy}
              placeholder="템플릿 이름"
              onChange={(e) => setTemplateForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>

          <label className="sms-composer__editor-label">
            본문
            <textarea
              className="sms-module__textarea sms-composer__textarea"
              rows={10}
              value={templateForm.message}
              disabled={busy}
              placeholder="보낼 문자 내용을 입력해 주세요."
              onChange={(e) => setTemplateForm((prev) => ({ ...prev, message: e.target.value }))}
            />
          </label>

          <SmsMessageMetaBar
            meta={meta}
            realSendEnabled={realSendEnabledFlag}
            transitionNotice={transitionNotice}
            onDismissTransition={dismissTransitionNotice}
          />
          <SmsVariableChips onInsert={insertToken} disabled={busy} />

          <label className="sms-composer__checkbox">
            <input
              type="checkbox"
              checked={templateForm.messageType === 'ad'}
              disabled={busy}
              onChange={(e) =>
                setTemplateForm((prev) => ({ ...prev, messageType: e.target.checked ? 'ad' : 'info' }))
              }
            />
            <span>광고성 문자입니다.</span>
          </label>

          <div className="sms-templates-workspace__form-actions">
            <FormButton
              type="button"
              disabled={busy || !templateForm.title.trim() || !templateForm.message.trim()}
              onClick={() => void handleSave()}
            >
              저장
            </FormButton>
          </div>
        </section>

        <aside className="sms-templates-workspace__preview" aria-label="휴대폰 미리보기">
          <SmsPhonePreview
            meta={meta}
            senderNumber={settings?.defaultSender}
            transitionNotice={transitionNotice}
            onDismissTransition={dismissTransitionNotice}
          />
        </aside>

        <div className="sms-templates-workspace__list">
          <SmsTemplateListPanel
            templates={templates}
            busy={busy}
            loadedId={loadedId}
            onLoad={handleLoad}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  )
}
