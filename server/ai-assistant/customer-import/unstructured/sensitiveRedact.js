const RRN_PATTERN = /\d{6}[-\s]?\d{7}/g
const ACCOUNT_PATTERN = /\b\d{3,4}[-\s]?\d{2,6}[-\s]?\d{2,8}\b/g

/**
 * @param {string} text
 */
export function redactSensitiveForExternalModel(text) {
  let rrnSeq = 0
  let accountSeq = 0
  let out = String(text ?? '')
  out = out.replace(RRN_PATTERN, () => {
    rrnSeq += 1
    return `<RRN_${rrnSeq}>`
  })
  out = out.replace(ACCOUNT_PATTERN, (match) => {
    if (match.replace(/\D/g, '').length < 10) {
      return match
    }
    accountSeq += 1
    return `<ACCOUNT_${accountSeq}>`
  })
  return { redactedText: out, rrnCount: rrnSeq, accountCount: accountSeq }
}

/**
 * Strip RRN/account lines from memo fields for customer import storage.
 * @param {string} text
 */
export function stripHighRiskFieldsFromMemo(text) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim()
      if (!t) {
        return false
      }
      if (RRN_PATTERN.test(t)) {
        return false
      }
      if (/주민|계좌|청구|병원치료|보험금/.test(t) && ACCOUNT_PATTERN.test(t)) {
        return false
      }
      return true
    })
  return lines.join('\n').trim()
}
