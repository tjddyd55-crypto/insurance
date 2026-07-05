import type { ReactNode } from 'react'
import { useSmsMessageComposeMeta } from '../../hooks/useSmsMessageComposeMeta'
import type { SmsPreviewAttachment } from '../../utils/smsMessageMeta'
import type { SmsPreviewSubstitution } from '../../utils/smsTemplateVariables'
import SmsMessageEditor from './SmsMessageEditor'
import SmsPhonePreview from './SmsPhonePreview'

type Props = {
  variant: 'pc' | 'mobile'
  message: string
  onMessageChange: (value: string) => void
  isAdvertisement: boolean
  onAdvertisementChange: (value: boolean) => void
  senderNumber?: string
  adDisplayName?: string | null
  attachment?: SmsPreviewAttachment
  previewSubstitution?: SmsPreviewSubstitution
  realSendEnabled: boolean
  disabled?: boolean
  layout?: 'default' | 'templates'
  showPreview?: boolean
  setupFields: ReactNode
  actions?: ReactNode
  below?: ReactNode
}

export default function SmsComposerLayout({
  variant,
  message,
  onMessageChange,
  isAdvertisement,
  onAdvertisementChange,
  senderNumber,
  adDisplayName = null,
  attachment = null,
  previewSubstitution = { mode: 'preserve' },
  realSendEnabled,
  disabled = false,
  layout = 'default',
  showPreview = true,
  setupFields,
  actions,
  below,
}: Props) {
  const { meta, transitionNotice, dismissTransitionNotice } = useSmsMessageComposeMeta({
    body: message,
    isAdvertisement,
    adDisplayName,
    attachments: attachment ? [attachment] : [],
    previewSubstitution,
  })

  return (
    <div
      className={`sms-composer sms-composer--${variant}${layout === 'templates' ? ' sms-composer--templates' : ''}`}
    >
      <div className="sms-composer__workspace">
        <div className="sms-composer__main">
          {setupFields ? <section className="sms-composer__card">{setupFields}</section> : null}
          <SmsMessageEditor
            message={message}
            onMessageChange={onMessageChange}
            meta={meta}
            isAdvertisement={isAdvertisement}
            onAdvertisementChange={onAdvertisementChange}
            attachment={attachment}
            realSendEnabled={realSendEnabled}
            transitionNotice={transitionNotice}
            onDismissTransition={dismissTransitionNotice}
            disabled={disabled}
            footer={actions}
          />
          {layout === 'templates' && below ? <div className="sms-composer__below">{below}</div> : null}
        </div>

        {showPreview ? (
          <SmsPhonePreview
            meta={meta}
            senderNumber={senderNumber}
            attachment={attachment}
            transitionNotice={transitionNotice}
            onDismissTransition={dismissTransitionNotice}
          />
        ) : null}
      </div>

      {layout !== 'templates' && below ? <div className="sms-composer__below">{below}</div> : null}
    </div>
  )
}

export function SmsComposerSetupFields({
  senderNumber,
  senderReadOnly = false,
  receiverField,
  recipientSummary,
}: {
  senderNumber?: string
  senderReadOnly?: boolean
  receiverField?: ReactNode
  recipientSummary?: ReactNode
}) {
  return (
    <>
      <h3 className="sms-composer__card-title">발송 기본 정보</h3>
      <div className="sms-composer__setup-grid">
        <div className="sms-composer__readonly-field">
          <span className="sms-composer__field-label">발신번호</span>
          <p className="sms-composer__field-value">{senderNumber || '—'}</p>
          {senderReadOnly ? (
            <p className="sms-composer__field-hint">변경은 문자 설정에서만 가능합니다.</p>
          ) : null}
        </div>
        {receiverField}
        {recipientSummary}
      </div>
    </>
  )
}
