import { useCallback, useMemo, useState } from 'react'
import type { LocalAttachmentDraft, NewsletterAttachment, NewsletterDetail } from '../types'
import { useAttachmentUploadQueue } from './useAttachmentUploadQueue'

function attachmentsToDrafts(attachments: NewsletterAttachment[]): LocalAttachmentDraft[] {
  return attachments.map((a) => ({
    localId: `existing-${a.id}`,
    file: new File([], a.fileName, {
      type: a.mimeType ?? (a.kind === 'pdf' ? 'application/pdf' : 'image/png'),
    }),
    kind: a.kind,
    previewUrl: a.kind === 'image' ? a.url : null,
    status: 'completed' as const,
    existingAttachmentId: a.id,
    cdnUrl: a.url,
    objectKey: a.objectKey,
    mimeType: a.mimeType,
    sizeBytes: a.size,
  }))
}

export function useInsurerNewsForm(existing: NewsletterDetail | null) {
  const [title, setTitle] = useState(existing?.title ?? '')
  const [bodyText, setBodyText] = useState(existing?.bodyText ?? '')
  const queue = useAttachmentUploadQueue(
    existing?.attachments?.length ? attachmentsToDrafts(existing.attachments) : [],
  )

  const isDirty = useMemo(() => {
    if (!existing) {
      return Boolean(title.trim() || bodyText.trim() || queue.items.length)
    }
    if (title !== existing.title || bodyText !== existing.bodyText) {
      return true
    }
    if (queue.items.length !== existing.attachments.length) {
      return true
    }
    return false
  }, [existing, title, bodyText, queue.items])

  const reset = useCallback(() => {
    setTitle(existing?.title ?? '')
    setBodyText(existing?.bodyText ?? '')
    queue.replaceAll(
      existing?.attachments?.length ? attachmentsToDrafts(existing.attachments) : [],
    )
  }, [existing, queue])

  return {
    title,
    setTitle,
    bodyText,
    setBodyText,
    attachments: queue.items,
    addAttachments: queue.addFiles,
    removeAttachment: queue.remove,
    attachmentSetStatus: queue.setStatus,
    replaceAttachments: queue.replaceAll,
    isDirty,
    reset,
  }
}
