export type AdvisorContactType = 'phone' | 'email' | 'url' | 'text'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[\d\s+\-().]{7,}$/

export function inferAdvisorContactType(value: string): AdvisorContactType {
  const v = value.trim()
  if (!v) return 'text'
  if (/^https?:\/\//i.test(v)) return 'url'
  if (EMAIL_RE.test(v)) return 'email'
  if (PHONE_RE.test(v) && /\d/.test(v)) return 'phone'
  return 'text'
}

export function buildAdvisorContactHref(
  value: string,
  type: AdvisorContactType,
): { href?: string; external?: boolean } {
  const v = value.trim()
  if (!v) return {}
  switch (type) {
    case 'phone':
      return { href: `tel:${v.replace(/\s/g, '')}` }
    case 'email':
      return { href: `mailto:${v}` }
    case 'url': {
      const url = /^https?:\/\//i.test(v) ? v : `https://${v}`
      return { href: url, external: true }
    }
    default:
      return {}
  }
}
