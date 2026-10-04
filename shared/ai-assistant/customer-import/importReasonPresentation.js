const PREFIX_MESSAGES = [
  { prefix: 'OPENAI_REQUEST_FAILED', message: 'AI 의미 분석에 실패했습니다. 수동 확인이 필요합니다.' },
  { prefix: 'OPENAI_', message: 'AI 분석을 완료하지 못했습니다.' },
  { prefix: 'GPT_CONFLICT_', message: '자동 인식 값과 AI 제안이 달라 확인이 필요합니다.' },
]

const EXACT_MESSAGES = Object.freeze({
  UNRESOLVED_SEMANTIC_FRAGMENTS: '일부 정보를 정확히 구분하지 못했습니다.',
  SEMANTIC_REVIEW: '추가 확인이 필요한 자료입니다.',
  SEMANTIC_GPT_CALL_CAP: '자동 분석 한도를 초과한 항목입니다. 수동 확인이 필요합니다.',
  REVIEW_REQUIRED: '등록 전 확인이 필요합니다.',
  DUPLICATE_EXISTING_CUSTOMER: '기존 고객과 동일한 정보가 확인되었습니다.',
  DUPLICATE_IN_FILE: '파일 안에 중복된 고객 정보가 있습니다.',
  DUPLICATE_POSSIBLE_NAME: '이름이 기존 고객과 유사합니다.',
  MISSING_PHONE: '휴대전화번호를 확인할 수 없습니다.',
  MISSING_NAME: '고객 이름을 확인할 수 없습니다.',
  MISSING_CUSTOMER_NAME: '고객 이름을 확인할 수 없습니다.',
  INVALID_PHONE: '전화번호 형식이 올바르지 않습니다.',
  INVALID_NAME_SHAPE: '이름 형식을 확인할 수 없습니다.',
  UNSUPPORTED_VALUE: '일부 값을 자동으로 등록할 수 없습니다.',
  MULTI_PERSON_CELL: '한 셀에 여러 고객이 있어 확인이 필요합니다.',
  GPT_MULTI_PERSON_HINT: '여러 사람 정보가 섞여 있어 확인이 필요합니다.',
  OPENAI_DISABLED: 'AI 분석이 비활성화되어 있습니다.',
  OPENAI_INVALID_OUTPUT: 'AI 분석 결과를 검증하지 못했습니다.',
  RRN_LOCKED: '주민등록번호는 자동 확정하지 않았습니다.',
})

/**
 * @param {string} reasonCode
 */
export function reasonCodeToUserMessage(reasonCode) {
  const raw = String(reasonCode ?? '').trim()
  if (!raw) {
    return ''
  }
  const base = raw.split(';')[0]
  if (EXACT_MESSAGES[base]) {
    return EXACT_MESSAGES[base]
  }
  for (const entry of PREFIX_MESSAGES) {
    if (base.startsWith(entry.prefix)) {
      return entry.message
    }
  }
  if (base.startsWith('GPT_CONFLICT_')) {
    return EXACT_MESSAGES.GPT_CONFLICT_phone ?? '자동 인식 값과 AI 제안이 달라 확인이 필요합니다.'
  }
  return '등록 전 확인이 필요합니다.'
}

/**
 * @param {string[]} reasons
 */
export function dedupeImportReasonCodes(reasons) {
  const seen = new Set()
  const ordered = []
  for (const reason of reasons ?? []) {
    const code = String(reason ?? '').trim()
    if (!code) {
      continue
    }
    const key = code.split(';')[0]
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    ordered.push(code)
  }
  return ordered
}

/**
 * @param {string[]} reasons
 */
export function mapImportReasonsForUser(reasons) {
  return dedupeImportReasonCodes(reasons).map((code) => ({
    code: code.split(';')[0],
    message: reasonCodeToUserMessage(code),
  }))
}
