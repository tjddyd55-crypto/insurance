import { useCallback, useMemo, useState } from 'react'
import FormButton from '../../../../components/form/FormButton'
import FormInput from '../../../../components/form/FormInput'
import { buildReservationPreviewSubstitution } from '../../utils/smsReservationPreviewSubstitution'
import { useSmsMessageComposeMeta } from '../../hooks/useSmsMessageComposeMeta'
import type { SmsModuleViewProps } from '../../hooks/useSmsModuleState'
import type { SmsTemplate } from '../../types/sms.types'
import SmsMessageComposer from '../common/SmsMessageComposer'
import SmsPhonePreview from '../common/SmsPhonePreview'
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
    handleCreateTemplateFromForm,
    handleDeleteTemplate,
    handleUpdateTemplate,
  } = module

  const [loadedId, setLoadedId] = useState<number | null>(null)
  const realSendEnabledFlag = Boolean(settings?.realSendEnabled)

  const previewSubstitution = useMemo(
    () =>
      buildReservationPreviewSubstitution({
        agentName: adDisplayName,
      }),
    [adDisplayName],
  )

  const { meta, transitionNotice, dismissTransitionNotice } = useSmsMessageComposeMeta({
    body: templateForm.message,
    isAdvertisement: templateForm.messageType === 'ad',
    adDisplayName,
    previewSubstitution,
  })

  const canSave = Boolean(templateForm.title.trim() && templateForm.message.trim())

  const resetForm = useCallback(() => {
    setLoadedId(null)
    setTemplateForm({ ...EMPTY_FORM, imageAttachment: null })
  }, [setTemplateForm])

  const handleNewDraft = useCallback(() => {
    resetForm()
  }, [resetForm])

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
        setLoadedId(null)
      }
    },
    [handleDeleteTemplate, loadedId],
  )

  const handleClearLoad = useCallback(() => {
    setLoadedId(null)
  }, [])

  const insertToken = useCallback(
    (token: string) => {
      setTemplateForm((prev) => ({ ...prev, message: `${prev.message}${token}` }))
    },
    [setTemplateForm],
  )

  const handleNewSave = async () => {
    const created = await handleSaveTemplate()
    if (created) {
      setLoadedId(null)
    }
  }

  const handleUpdateLoaded = async () => {
    if (loadedId == null) {
      return
    }
    const title = templateForm.title.trim()
    const message = templateForm.message.trim()
    if (!title || !message) {
      return
    }
    await handleUpdateTemplate(loadedId, {
      title,
      message,
      messageType: templateForm.messageType,
    })
  }

  const handleSaveAsNew = async () => {
    const created = await handleCreateTemplateFromForm()
    if (created) {
      setLoadedId(created.id)
    }
  }

  return (
    <div className={`sms-templates-workspace sms-templates-workspace--${variant}`}>
      <header className="sms-templates-workspace__head">
        <div className="sms-templates-workspace__head-main">
          <h2 className="sms-templates-workspace__title">템플릿관리</h2>
          <p className="sms-module__muted">
            자주 사용하는 문자 내용을 저장하고, 즉시·예약 발송 화면에서 불러올 수 있습니다.
          </p>
        </div>
      </header>

      <div className="sms-templates-workspace__grid">
        <div className="sms-templates-workspace__list">
          <SmsTemplateListPanel
            templates={templates}
            busy={busy}
            loadedId={loadedId}
            onLoad={handleLoad}
            onDelete={handleDelete}
          />
        </div>

        <section className="sms-composer__card sms-templates-workspace__form">
          <div className="sms-templates-workspace__form-head">
            <h3 className="sms-composer__card-title">템플릿 작성</h3>
            <FormButton type="button" variant="secondary" disabled={busy} onClick={handleNewDraft}>
              새 템플릿 작성
            </FormButton>
          </div>

          {loadedId != null ? (
            <p className="sms-module__muted sms-templates-workspace__loaded-hint">
              불러온 템플릿을 수정 저장하거나, 새 템플릿으로 따로 저장할 수 있습니다.
            </p>
          ) : null}

          <label>
            템플릿명
            <FormInput
              value={templateForm.title}
              disabled={busy}
              placeholder="템플릿 이름"
              onChange={(e) => setTemplateForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>

          <SmsMessageComposer
            label="본문"
            value={templateForm.message}
            onChange={(message) => setTemplateForm((prev) => ({ ...prev, message }))}
            meta={meta}
            realSendEnabled={realSendEnabledFlag}
            transitionNotice={transitionNotice}
            onDismissTransition={dismissTransitionNotice}
            disabled={busy}
            variableButtons={<SmsVariableChips onInsert={insertToken} disabled={busy} />}
          />

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
            {loadedId == null ? (
              <FormButton type="button" disabled={busy || !canSave} onClick={() => void handleNewSave()}>
                새 템플릿 저장
              </FormButton>
            ) : (
              <>
                <FormButton type="button" disabled={busy || !canSave} onClick={() => void handleUpdateLoaded()}>
                  수정 저장
                </FormButton>
                <FormButton type="button" variant="secondary" disabled={busy || !canSave} onClick={() => void handleSaveAsNew()}>
                  새 템플릿으로 저장
                </FormButton>
                <FormButton type="button" variant="secondary" disabled={busy} onClick={handleClearLoad}>
                  불러오기 해제
                </FormButton>
              </>
            )}
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
      </div>
    </div>
  )
}
