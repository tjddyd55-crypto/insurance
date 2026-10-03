const RRN_PATTERN = /\d{6}[-\s]?\d{7}/g
const MOBILE_PATTERN = /01[016789][\s\-]?\d{3,4}[\s\-]?\d{4}/g
const ACCOUNT_PATTERN = /\b\d{3,4}[-\s]?\d{2,6}[-\s]?\d{2,8}\b/g
const PLATE_PATTERN = /\b\d{2,3}[가-힣]\d{4}\b/g

/** Lines/fragments that likely contain clinical or claims detail — never send raw text to GPT. */
const MEDICAL_SENSITIVE_LINE =
  /(?:병력|병력사항|수술|질병|약복용|복용약|입원|치료|진단|고혈압|당뇨|보험금|청구|실손|\bMRI\b|\bCT\b|항암|처방|의료|병원|수면내시경|백내장|암|우울|정신|우울증|치매|뇌졸중|심장|관상동맥)/i

/**
 * @param {string} line
 */
export function isMedicalSensitiveFragment(line) {
  const t = String(line ?? '').trim()
  if (!t) {
    return false
  }
  if (!MEDICAL_SENSITIVE_LINE.test(t)) {
    return false
  }
  return t.length > 12 || /[:：]/.test(t)
}

/**
 * @param {string[]} lines
 */
export function redactMedicalLinesForGpt(lines, vault, stats) {
  let medicalSeq = stats.medicalSeq ?? 0
  return lines.map((line) => {
    if (!isMedicalSensitiveFragment(line)) {
      return line
    }
    medicalSeq += 1
    const token = `<MEDICAL_${medicalSeq}>`
    vault.set(token, '[REDACTED_MEDICAL]')
    return token
  })
}

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
  let medicalSeq = 0

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

  let contextLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  contextLines = redactMedicalLinesForGpt(contextLines, vault, { medicalSeq })
  medicalSeq = contextLines.filter((l) => /^<MEDICAL_\d+>$/.test(l)).length

  const redactedText = contextLines.join('\n')

  return {
    contextLines,
    redactedText,
    vault,
    redactionStats: { rrnSeq, phoneSeq, accountSeq, plateSeq, medicalSeq },
    medicalRawSentToGpt: false,
  }
}

/**
 * QA: ensure GPT payload strings contain no raw medical/clinical long text.
 * @param {string} payloadJson
 */
export function gptPayloadContainsRawMedical(payloadJson) {
  const s = String(payloadJson ?? '')
  if (MEDICAL_SENSITIVE_LINE.test(s) && s.length > 80) {
    const withoutTokens = s.replace(/<(?:RRN|PHONE|CAR_PLATE|ACCOUNT|MEDICAL)_\d+>/g, '')
    if (MEDICAL_SENSITIVE_LINE.test(withoutTokens) && withoutTokens.length > 40) {
      return true
    }
  }
  return false
}
