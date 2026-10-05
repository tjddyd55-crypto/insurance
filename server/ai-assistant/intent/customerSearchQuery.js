import { messageUsesPreviousCustomerReference } from './resolveCustomerReference.js'

const GENERIC_CUSTOMER_NOUNS = new Set(['고객', '사람', '회원', '대상', 'customer'])

/**
 * @param {string | null | undefined} value
 */
export function isGenericCustomerNoun(value) {
  const t = String(value ?? '').trim()
  if (!t) {
    return true
  }
  if (GENERIC_CUSTOMER_NOUNS.has(t)) {
    return true
  }
  return /^(그\s*)?(사람|고객|회원)$/.test(t)
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function extractCustomerNameHint(text) {
  const t = String(text ?? '').trim()
  const qa = t.match(/AI테스트_[^\s]+/)
  if (qa) {
    return qa[0]
  }
  const phone = t.match(/(?:01[016789]|0\d{1,2})[-\s]?\d{3,4}[-\s]?\d{4}/)
  if (phone) {
    return phone[0].replace(/\s/g, '')
  }
  const m = t.match(/([가-힣A-Za-z0-9_]{2,})\s*(찾|검색|보여|알려)/)
  if (m && !isGenericCustomerNoun(m[1])) {
    return m[1]
  }
  return null
}

/**
 * @param {{ text: string, target?: object | null, classified?: object }} input
 * @returns {{ query: string | null, reason?: string }}
 */
export function buildCustomerSearchQuery(input) {
  const text = String(input.text ?? '').trim()
  const target = input.target ?? {}
  const classified = input.classified ?? {}

  if (
    target.reference === 'previous_customer' ||
    messageUsesPreviousCustomerReference(text)
  ) {
    return { query: null, reason: 'REFERENCE_ONLY' }
  }

  const fromTarget = target.name ?? classified.filters?.name ?? null
  if (fromTarget && !isGenericCustomerNoun(fromTarget)) {
    return { query: String(fromTarget).trim() }
  }

  const hint = extractCustomerNameHint(text)
  if (hint) {
    return { query: hint }
  }

  return { query: null, reason: 'MISSING_TARGET' }
}

/**
 * @param {string | null | undefined} query
 * @param {string} text
 */
export function isCustomerSearchMissingTarget(query, text) {
  const t = String(text ?? '').trim()
  if (/^(고객|사람)\s*(찾기|검색|찾아줘?|찾아)?$/i.test(t)) {
    return true
  }
  const q = String(query ?? '').trim()
  if (!q) {
    return true
  }
  return isGenericCustomerNoun(q)
}
