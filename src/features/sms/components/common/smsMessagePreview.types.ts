import type { ReactNode } from 'react'
import type { SmsMessageMeta, SmsPreviewAttachment } from '../../utils/smsMessageMeta'

export type SmsPhonePreviewProps = {
  /** 미리보기 본문. `meta`가 있으면 `meta.previewText`가 우선한다. */
  message?: string
  meta?: SmsMessageMeta
  senderNumber?: string
  headerLabel?: string
  emptyMessage?: string
  attachment?: SmsPreviewAttachment | null
  transitionNotice?: string | null
  onDismissTransition?: () => void
  compact?: boolean
  hideCaption?: boolean
  showDescription?: boolean
  description?: string
  footer?: ReactNode
  className?: string
}

export type SmsMessageLengthIndicatorProps = {
  meta: SmsMessageMeta
  realSendEnabled?: boolean
  transitionNotice?: string | null
  onDismissTransition?: () => void
  className?: string
}

export type SmsMessageComposerProps = {
  value: string
  onChange: (value: string) => void
  meta: SmsMessageMeta
  label?: string
  placeholder?: string
  maxLength?: number
  rows?: number
  disabled?: boolean
  readOnly?: boolean
  realSendEnabled?: boolean
  transitionNotice?: string | null
  onDismissTransition?: () => void
  variableButtons?: ReactNode
  helperText?: ReactNode
  validationMessage?: ReactNode
  showWrapHint?: boolean
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  onTextareaSelect?: () => void
  className?: string
}
