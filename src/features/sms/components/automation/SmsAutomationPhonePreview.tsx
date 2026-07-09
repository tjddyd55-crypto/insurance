import { useMemo } from 'react'
import { useSmsMessageComposeMeta } from '../../hooks/useSmsMessageComposeMeta'
import type { SmsAutomationRuleFormState, SmsAutomationRulePreview } from '../../types/smsAutomationRuleTypes'
import { buildAutomationPhonePreviewMessage } from '../../utils/smsAutomationPreviewMessage'
import SmsPhonePreview from '../composer/SmsPhonePreview'

export type SmsAutomationPhonePreviewProps = {
  form: SmsAutomationRuleFormState
  preview: SmsAutomationRulePreview | null
  baseDate: string
  senderNumber?: string
  compact?: boolean
}

export function SmsAutomationPhonePreview({
  form,
  preview,
  baseDate,
  senderNumber,
  compact = false,
}: SmsAutomationPhonePreviewProps) {
  const phonePreview = useMemo(
    () =>
      buildAutomationPhonePreviewMessage({
        messageBody: form.messageBody,
        triggerType: form.triggerType,
        dayOffset: form.dayOffset,
        baseDate,
        preview,
      }),
    [form.messageBody, form.triggerType, form.dayOffset, baseDate, preview],
  )

  const { meta } = useSmsMessageComposeMeta({
    body: phonePreview.message,
    isAdvertisement: false,
    previewSubstitution: { mode: 'preserve' },
  })

  return (
    <aside className="sms-automation-rules__phone-preview-panel" aria-label="휴대폰 미리보기">
      <h2 className="sms-automation-rules__panel-title">휴대폰 미리보기</h2>
      <SmsPhonePreview
        meta={meta}
        senderNumber={phonePreview.phone || senderNumber}
        hideCaption
        compact={compact}
      />
    </aside>
  )
}
