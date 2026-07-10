/**
 * 소식지 plain-text 본문 토큰화 — URL / 전화번호 / 줄바꿈.
 * 저장 원문은 변경하지 않고, 렌더 시에만 사용한다.
 */

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi

/** 한국 전화 — 하이픈/공백 허용 */
const PHONE_CANDIDATE_RE =
  /(?:0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}|01[016789][-\s]?\d{3,4}[-\s]?\d{4}|1[5-9]\d{2}[-\s]?\d{4})/g

export function normalizeTelHref(raw) {
  return String(raw ?? '').replace(/\D/g, '')
}

export function toAbsoluteHttpUrl(raw) {
  const value = String(raw ?? '').trim()
  if (!value) {
    return ''
  }
  if (/^https?:\/\//i.test(value)) {
    return value
  }
  if (/^www\./i.test(value)) {
    return `https://${value}`
  }
  return value
}

export function extractFirstExternalUrl(text) {
  const matches = String(text ?? '').match(URL_RE)
  if (!matches?.length) {
    return null
  }
  for (const raw of matches) {
    const cleaned = raw.replace(/[),.;!?]+$/g, '')
    const href = toAbsoluteHttpUrl(cleaned)
    try {
      const u = new URL(href)
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return href
      }
    } catch {
      // skip
    }
  }
  return null
}

function isLikelyPhone(raw, before, after) {
  const digits = normalizeTelHref(raw)
  if (digits.length < 8 || digits.length > 11) {
    return false
  }
  if (/[\d.]/.test(before.slice(-1)) || /[\d.]/.test(after.slice(0, 1))) {
    return false
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return false
  }
  return true
}

function pushText(tokens, value) {
  if (!value) {
    return
  }
  tokens.push({ type: 'text', value })
}

function tokenizePhonesInSegment(segment, tokens) {
  PHONE_CANDIDATE_RE.lastIndex = 0
  let last = 0
  let match
  while ((match = PHONE_CANDIDATE_RE.exec(segment)) != null) {
    const start = match.index
    const raw = match[0]
    const before = segment.slice(Math.max(0, start - 1), start)
    const after = segment.slice(start + raw.length, start + raw.length + 1)
    if (!isLikelyPhone(raw, before, after)) {
      continue
    }
    pushText(tokens, segment.slice(last, start))
    tokens.push({ type: 'phone', value: raw, href: `tel:${normalizeTelHref(raw)}` })
    last = start + raw.length
  }
  pushText(tokens, segment.slice(last))
}

export function parseTextTokens(text) {
  const source = String(text ?? '')
  if (!source) {
    return []
  }

  const tokens = []
  const lines = source.split('\n')

  lines.forEach((line, lineIndex) => {
    URL_RE.lastIndex = 0
    let last = 0
    let match
    while ((match = URL_RE.exec(line)) != null) {
      const start = match.index
      let raw = match[0]
      const trailingMatch = raw.match(/[),.;!?]+$/)
      const trailing = trailingMatch ? trailingMatch[0] : ''
      if (trailing) {
        raw = raw.slice(0, -trailing.length)
      }
      tokenizePhonesInSegment(line.slice(last, start), tokens)
      tokens.push({ type: 'url', value: raw, href: toAbsoluteHttpUrl(raw) })
      last = start + raw.length
      if (trailing) {
        pushText(tokens, trailing)
        last += trailing.length
      }
    }
    tokenizePhonesInSegment(line.slice(last), tokens)
    if (lineIndex < lines.length - 1) {
      tokens.push({ type: 'lineBreak' })
    }
  })

  return tokens.filter((t) => t.type !== 'text' || t.value.length > 0)
}
