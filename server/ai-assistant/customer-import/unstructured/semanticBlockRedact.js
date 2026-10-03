const RRN_PATTERN = /\d{6}[-\s]?\d{7}/g
const MOBILE_PATTERN = /01[016789][\s\-]?\d{3,4}[\s\-]?\d{4}/g
const ACCOUNT_PATTERN = /\b\d{3,4}[-\s]?\d{2,6}[-\s]?\d{2,8}\b/g
const PLATE_PATTERN = /\b\d{2,3}[가-힣]\d{4}\b/g

/**
 * Build redacted line context + vault for GPT (server restores tokens after response).
 * @param {string} sourceText
 */
export function buildRedactedSemanticGptContext(sourceText) {
  /** @type {Map<string, string>} */
  const vault = new Map()
  let text = String(sourceText ?? '')
  let rrnSeq = 0
  let phoneSeq = 0
  let accountSeq = 0
  let plateSeq = 0

  text = text.replace(RRN_PATTERN, (match) => {
    rrnSeq += 1
    const token = `<RRN_${rrnSeq}>`
    vault.set(token, match.replace(/\s/g, ''))
    return token
  })
  text = text.replace(MOBILE_PATTERN, (match) => {
    phoneSeq += 1
    const token = `<PHONE_${phoneSeq}>`
    vault.set(token, match)
    return token
  })
  text = text.replace(PLATE_PATTERN, (match) => {
    plateSeq += 1
    const token = `<CAR_PLATE_${plateSeq}>`
    vault.set(token, match)
    return token
  })
  text = text.replace(ACCOUNT_PATTERN, (match) => {
    if (match.replace(/\D/g, '').length < 10) {
      return match
    }
    accountSeq += 1
    const token = `<ACCOUNT_${accountSeq}>`
    vault.set(token, match)
    return token
  })

  const contextLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return {
    contextLines,
    redactedText: text,
    vault,
    redactionStats: { rrnSeq, phoneSeq, accountSeq, plateSeq },
  }
}
