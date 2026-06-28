import type { Editor } from '@tiptap/core'
import { fetchAdminNoticeLinkPreview } from '../api/adminNoticesApi'

export function isStandaloneUrl(text: string): boolean {
  const trimmed = text.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    return false
  }
  try {
    const url = new URL(trimmed)
    return Boolean(url.hostname)
  } catch {
    return false
  }
}

export async function insertNoticeLinkPreview(editor: Editor, token: string, url: string): Promise<boolean> {
  const trimmedUrl = url.trim()
  if (!isStandaloneUrl(trimmedUrl)) {
    return false
  }

  const preview = await fetchAdminNoticeLinkPreview(token, trimmedUrl)
  if (preview) {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'noticeLinkPreview',
        attrs: {
          url: preview.url,
          title: preview.title || preview.url,
          description: preview.description || '',
          image: preview.image || '',
          domain: preview.domain || '',
        },
      })
      .run()
    return true
  }

  editor
    .chain()
    .focus()
    .insertContent({
      type: 'text',
      text: trimmedUrl,
      marks: [{ type: 'link', attrs: { href: trimmedUrl, target: '_blank', rel: 'noopener noreferrer' } }],
    })
    .run()
  return true
}
