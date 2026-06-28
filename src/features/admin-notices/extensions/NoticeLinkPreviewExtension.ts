import { Node, mergeAttributes } from '@tiptap/core'

export type NoticeLinkPreviewAttrs = {
  url: string
  title: string
  description: string
  image: string
  domain: string
}

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
    }
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
          return {
            url,
            title: element.querySelector('.admin-notice-link-preview__title')?.textContent?.trim() || url,
            description:
              element.querySelector('.admin-notice-link-preview__description')?.textContent?.trim() || '',
            image: element.querySelector('img')?.getAttribute('src')?.trim() || '',
            domain: element.querySelector('.admin-notice-link-preview__domain')?.textContent?.trim() || '',
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
      }),
      [
        'a',
        { href: url, target: '_blank', rel: 'noopener noreferrer' },
        ...linkChildren,
      ],
    ]
  },
})
