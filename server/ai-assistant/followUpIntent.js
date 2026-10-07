import { CUSTOMER_IMPORT_DUPLICATE_POLICY } from '../../shared/ai-assistant/customer-import/constants.js'
import {
  applySourceColumnMapping,
  resolveDestinationFromUserToken,
} from '../../shared/ai-assistant/customer-import/mappingEdit.js'

/**
 * @param {string} text
 * @returns {{ sourceHeader: string, destinationToken: string }|null}
 */
export function parseMappingChangeIntent(text) {
  const t = String(text ?? '').trim()
  if (!t) {
    return null
  }
  const patterns = [
    /(.+?)\s*(?:컬럼|열)\s*(?:은|는)?\s*(.+?)(?:으로|로)?\s*(?:넣|매핑|변경|바꿔|해|맵)/,
    /(.+?)\s*(?:컬럼|열)\s*(?:을|를)?\s*(.+?)(?:으로|로)?\s*(?:넣|매핑|변경|바꿔)/,
    /(.+?)\s*(?:은|는)\s*(.+?)(?:으로|로)\s*(?:넣|매핑|변경|바꿔)/,
  ]
  for (const pattern of patterns) {
    const match = t.match(pattern)
    if (!match) {
      continue
    }
    const sourceHeader = String(match[1] ?? '').trim()
    const destinationToken = String(match[2] ?? '').trim()
    if (sourceHeader && destinationToken) {
      return { sourceHeader, destinationToken }
    }
  }
  return null
}

/**
 * @param {string} text
 * @returns {'SKIP'|'INCLUDE'|null}
 */
export function parseDuplicatePolicyIntent(text) {
  const t = String(text ?? '')
  if (/중복.*(빼|제외|스킵|빼줘|제외해)/.test(t)) {
    return CUSTOMER_IMPORT_DUPLICATE_POLICY.SKIP
  }
  if (/중복.*(포함|넣|등록)/.test(t)) {
    return CUSTOMER_IMPORT_DUPLICATE_POLICY.INCLUDE
  }
  return null
}

/**
 * @param {string} text
 */
export function detectNaturalLanguageCommitIntent(text) {
  const t = String(text ?? '').trim()
  if (!t) {
    return false
  }
  return /^(응|네|좋아|그래|진행|등록|올려|올려줘|그대로|확인)$/.test(t) || /등록해|올려줘|진행해/.test(t)
}

/**
 * @param {string} text
 * @param {string[]} headers
 * @param {Record<string, string>} columnMapping
 */
export function applyMappingChangeFromText(text, headers, columnMapping) {
  const intent = parseMappingChangeIntent(text)
  if (!intent) {
    return null
  }
  const destination = resolveDestinationFromUserToken(intent.destinationToken)
  if (!destination) {
    throw Object.assign(new Error('UNKNOWN_DESTINATION'), { code: 'UNKNOWN_DESTINATION', status: 400 })
  }
  return applySourceColumnMapping(columnMapping, headers, intent.sourceHeader, destination)
}
