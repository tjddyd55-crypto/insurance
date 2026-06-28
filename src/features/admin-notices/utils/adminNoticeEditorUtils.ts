import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { fetchAdminNoticeLinkPreview } from '../api/adminNoticesApi'

export type NoticeAlign = 'left' | 'center' | 'right'

const ALIGNABLE_NODE_TYPES = new Set(['image', 'noticeLinkPreview'])

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

function normalizePreviewUrl(url: string): string {
  return String(url ?? '').trim()
}

function hasAdjacentLinkPreview(doc: Editor['state']['doc'], blockIndex: number, url: string): boolean {
  if (blockIndex + 1 >= doc.childCount) {
    return false
  }
  const next = doc.child(blockIndex + 1)
  return (
    next.type.name === 'noticeLinkPreview' &&
    normalizePreviewUrl(next.attrs.url) === normalizePreviewUrl(url)
  )
}

function buildUrlLinkParagraph(url: string) {
  return {
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: url,
        marks: [{ type: 'link', attrs: { href: url, target: '_blank', rel: 'noopener noreferrer' } }],
      },
    ],
  }
}

export async function insertNoticeLinkPreview(editor: Editor, token: string, url: string): Promise<boolean> {
  const trimmedUrl = url.trim()
  if (!isStandaloneUrl(trimmedUrl)) {
    return false
  }

  const blockIndex = editor.state.selection.$from.index(0)
  if (hasAdjacentLinkPreview(editor.state.doc, blockIndex, trimmedUrl)) {
    return true
  }

  const preview = await fetchAdminNoticeLinkPreview(token, trimmedUrl)
  const content: Array<Record<string, unknown>> = [buildUrlLinkParagraph(trimmedUrl)]

  if (preview) {
    const previewUrl = normalizePreviewUrl(preview.url)
    const doc = editor.state.doc
    const insertAt = editor.state.selection.$from.index(0)
    if (!hasAdjacentLinkPreview(doc, insertAt, previewUrl) && !hasAdjacentLinkPreview(doc, insertAt, trimmedUrl)) {
      content.push({
        type: 'noticeLinkPreview',
        attrs: {
          url: preview.url,
          title: preview.title || preview.url,
          description: preview.description || '',
          image: preview.image || '',
          domain: preview.domain || '',
          align: 'left',
        },
      })
    }
  }

  editor.chain().focus().insertContent(content).run()
  return true
}

export function applyNoticeAlign(editor: Editor, align: NoticeAlign): void {
  const { state, view } = editor
  const { selection, doc } = state

  if (selection instanceof NodeSelection && ALIGNABLE_NODE_TYPES.has(selection.node.type.name)) {
    view.dispatch(
      state.tr.setNodeMarkup(selection.from, undefined, {
        ...selection.node.attrs,
        align,
      }),
    )
    return
  }

  if (editor.isActive('image')) {
    editor.chain().focus().updateAttributes('image', { align }).run()
    return
  }

  if (editor.isActive('noticeLinkPreview')) {
    editor.chain().focus().updateAttributes('noticeLinkPreview', { align }).run()
    return
  }

  const { from, to } = selection
  const tr = state.tr
  let nodeChanged = false

  doc.nodesBetween(from, to, (node, pos) => {
    if (!ALIGNABLE_NODE_TYPES.has(node.type.name)) {
      return
    }
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, align })
    nodeChanged = true
  })

  if (nodeChanged) {
    view.dispatch(tr)
  }

  editor.chain().focus().setTextAlign(align).run()
}

export function isNoticeAlignActive(editor: Editor, align: NoticeAlign): boolean {
  if (editor.isActive('image')) {
    return (editor.getAttributes('image').align || 'left') === align
  }
  if (editor.isActive('noticeLinkPreview')) {
    return (editor.getAttributes('noticeLinkPreview').align || 'left') === align
  }
  return editor.isActive({ textAlign: align })
}
