/**
 * Lightweight hints for ONE FC tool routing (not intent by keyword alone).
 * Used when GPT is unavailable or to validate requiredToolKey.
 */

/**
 * @param {string} text
 * @returns {string|null} registry tool key
 */
export function detectBusinessToolKeyHint(text) {
  const t = String(text ?? '').trim()
  if (!t) {
    return null
  }
  if (/([가-힣]{2,4}).*(찾|검색)/.test(t) || (/고객/.test(t) && /(찾|검색)/.test(t))) {
    return 'customer.search'
  }
  if (/^(그\s*)?(사람|고객)/.test(t) && /(상담|파일|페이지)/.test(t)) {
    if (/상담/.test(t)) {
      return 'consultation.recent'
    }
    if (/파일|첨부|자료/.test(t)) {
      return 'customer.files.list'
    }
    if (/페이지/.test(t)) {
      return 'customer.get'
    }
  }
  if (/할\s*일|todo|task/i.test(t) || /오늘\s*할/.test(t)) {
    return 'task.list'
  }
  if (/청구/.test(t) && /(미처리|목록|현황|보여|확인)/.test(t)) {
    return 'claim.list'
  }
  if (/일정|calendar/i.test(t)) {
    return 'schedule.list'
  }
  if (/상담/.test(t) && /(알려|조회|내용|뭐|최근)/.test(t)) {
    return 'consultation.recent'
  }
  if (/파일|첨부|자료/.test(t) && /(뭐|목록|보여|있)/.test(t)) {
    return 'customer.files.list'
  }
  if (/청구/.test(t) && /(미처리|목록|현황|보여|확인)/.test(t)) {
    return 'claim.list'
  }
  if (/페이지/.test(t) && /(열|보여|이동)/.test(t)) {
    return 'customer.get'
  }
  if (/(문자|sms)/i.test(t) && /(보내|발송|전송)/.test(t)) {
    return 'sms.send'
  }
  if (/보내|발송|전송/.test(t) && /(한테|에게|고객)/.test(t)) {
    return 'sms.send'
  }
  return null
}

/**
 * Explain / how-to questions should not route to unsupported tool responses.
 * @param {string} text
 */
export function isExplainOrGeneralKnowledgeQuestion(text) {
  const t = String(text ?? '').trim()
  if (!t) {
    return false
  }
  if (/상담/.test(t) && /(최근|내용|조회|알려)/.test(t) && /(김|이름|고객|누구)/.test(t)) {
    return false
  }
  if (/어떻게|방법|절차|무엇|뭐야|차이|설명|예시/.test(t) && !/(해줘|해 주|보내|삭제|등록해|넣어줘)/.test(t)) {
    return true
  }
  if (/알려줘|알려 주/.test(t) && !/(보내|삭제|등록|상담)/.test(t)) {
    return true
  }
  return false
}

/**
 * @param {string} text
 */
export function detectCustomerImportGoal(text) {
  const t = String(text ?? '').trim()
  if (!t) {
    return false
  }
  if (/고객.*(등록|가져|넣어|올려|추가|import)/i.test(t)) {
    return true
  }
  if (/등록.*고객|가져오기|고객리스트|엑셀.*고객/i.test(t)) {
    return true
  }
  if (/이\s*(파일|거|첨부|자료).*(고객|등록|넣|처리|확인)/.test(t)) {
    return true
  }
  if (/파일.*(확인|처리).*(등록|고객)/.test(t)) {
    return true
  }
  if (/고객.*(넣|올려|등록)/.test(t)) {
    return true
  }
  if (/중복/.test(t) && /(빼|포함|제외)/.test(t)) {
    return true
  }
  if (/컬럼|매핑/.test(t) && /(넣|연결|수정|바꿔)/.test(t)) {
    return true
  }
  if (/미리보기/.test(t)) {
    return true
  }
  return false
}

/**
 * Small talk / permission to ask / general chat (safe heuristic, not exhaustive).
 * @param {string} text
 */
export function isLikelyGeneralConversation(text) {
  const t = String(text ?? '').trim()
  if (!t) {
    return true
  }
  if (/^(안녕|하이|헬로|고마워|감사|알겠어|네|응)$/.test(t)) {
    return true
  }
  if (/질문.*(해도|할게|할께|하나)|물어볼|물어봐|궁금/.test(t)) {
    return true
  }
  if (/작성해줘|써줘|바꿔줘|요약해줘|부드럽게/.test(t) && !/(보내|발송|등록|삭제)/.test(t)) {
    return true
  }
  return false
}
