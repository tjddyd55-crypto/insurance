import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'img',
  'span',
  'div',
]

/**
 * @param {unknown} html
 */
export function sanitizeAdminNoticeHtml(html) {
  return sanitizeHtml(String(html ?? ''), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
      span: ['style'],
      div: ['style'],
      p: ['style'],
      h1: ['style'],
      h2: ['style'],
      h3: ['style'],
    },
    allowedStyles: {
      '*': {
        color: [/^#(?:[0-9a-fA-F]{3,8})$/, /^rgb\(/i],
        'font-size': [/^\d+(?:\.\d+)?(?:px|em|rem|%)$/],
        'text-align': [/^(?:left|right|center|justify)$/],
      },
    },
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          href: attribs.href,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
      a: ['http', 'https', 'mailto'],
    },
  })
}

/**
 * @param {unknown} html
 */
export function derivePlainTextFromHtml(html) {
  const cleaned = sanitizeAdminNoticeHtml(html)
  return cleaned
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-3]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
