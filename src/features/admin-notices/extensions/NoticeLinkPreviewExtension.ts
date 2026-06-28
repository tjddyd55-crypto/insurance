import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { NoticeLinkPreviewNodeView } from './NoticeLinkPreviewNodeView'

export type NoticeLinkPreviewAttrs = {
  url: string
  title: string
  description: string
  image: string
  domain: string
  align: 'left' | 'center' | 'right'
}

const NOTICE_ALIGNMENTS = ['left', 'center', 'right']

export const NoticeLinkPreview = Node.create({
  name: 'noticeLinkPreview',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
      description: { default: '' },
      image: { default: '' },
      domain: { default: '' },
      align: {
        default: 'left',
        parseHTML: (element) => {
          if (!(element instanceof HTMLElement)) {
            return 'left'
          }
          const align = element.getAttribute('data-align')
          return NOTICE_ALIGNMENTS.includes(String(align)) ? align : 'left'
        },
        renderHTML: (attributes) => ({
          'data-align': NOTICE_ALIGNMENTS.includes(String(attributes.align)) ? attributes.align : 'left',
        }),
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoticeLinkPreviewNodeView)
  },

  parseHTML() {
    return [
      {
        tag: 'div.admin-notice-link-preview',
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) {
            return false
          }
          const anchor = element.querySelector('a')
          const url =
            element.getAttribute('data-url')?.trim() ||
            anchor?.getAttribute('href')?.trim() ||
            ''
          const align = element.getAttribute('data-align')
          return {
            url,
            title: element.querySelector('.admin-notice-link-preview__title')?.textContent?.trim() || url,
            description:
              element.querySelector('.admin-notice-link-preview__description')?.textContent?.trim() || '',
            image: element.querySelector('img')?.getAttribute('src')?.trim() || '',
            domain: element.querySelector('.admin-notice-link-preview__domain')?.textContent?.trim() || '',
            align: NOTICE_ALIGNMENTS.includes(String(align)) ? align : 'left',
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const url = String(HTMLAttributes.url ?? '').trim()
    const title = String(HTMLAttributes.title ?? url).trim()
    const description = String(HTMLAttributes.description ?? '').trim()
    const image = String(HTMLAttributes.image ?? '').trim()
    const domain = String(HTMLAttributes.domain ?? '').trim()
    const align = NOTICE_ALIGNMENTS.includes(String(HTMLAttributes.align)) ? HTMLAttributes.align : 'left'

    const linkChildren: Array<string | Record<string, string> | Array<unknown>> = []
    if (image) {
      linkChildren.push(['img', { src: image, alt: '' }])
    }

    const bodyChildren: Array<string | Record<string, string> | Array<unknown>> = [
      ['strong', { class: 'admin-notice-link-preview__title' }, title || url],
    ]
    if (description) {
      bodyChildren.push(['p', { class: 'admin-notice-link-preview__description' }, description])
    }
    bodyChildren.push(['span', { class: 'admin-notice-link-preview__domain' }, domain])

    linkChildren.push(['div', { class: 'admin-notice-link-preview__body' }, ...bodyChildren])

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'admin-notice-link-preview',
        'data-url': url,
        'data-align': align,
      }),
      [
        'a',
        { href: url, target: '_blank', rel: 'noopener noreferrer' },
        ...linkChildren,
      ],
    ]
  },
})
