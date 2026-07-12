import type { SmsPhonePreviewProps } from './smsMessagePreview.types'

export function resolveSmsPhonePreviewMessage({
  message,
  meta,
  emptyMessage = '보낼 문자 내용을 입력해 주세요.',
}: Pick<SmsPhonePreviewProps, 'message' | 'meta' | 'emptyMessage'>) {
  const text = (meta?.previewText ?? message ?? '').trim()
  return {
    text,
    isEmpty: text.length === 0,
    emptyMessage,
    typeLabel: meta?.typeLabel ?? '단문(SMS)',
  }
}
