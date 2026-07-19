/**
 * 고객등록 초대 링크 URL 빌더 (클라/서버 공통 규칙).
 * /customer/register?ref={username}&ga={GA_CODE}
 */

/**
 * @param {{
 *   origin: string,
 *   refUsername: string,
 *   gaCode: string,
 * }} input
 * @returns {string} 완성 URL 또는 빈 문자열
 */
export function buildCustomerRegistrationInviteUrl(input) {
  const origin = String(input?.origin ?? '')
    .trim()
    .replace(/\/$/, '')
  const refUsername = String(input?.refUsername ?? '').trim()
  const gaCode = String(input?.gaCode ?? '')
    .trim()
    .toUpperCase()
  if (!origin || !refUsername || !gaCode) {
    return ''
  }
  return `${origin}/customer/register?ref=${encodeURIComponent(refUsername)}&ga=${encodeURIComponent(gaCode)}`
}

/**
 * SMS 본문 (고객등록 링크 포함).
 * @param {string} registrationUrl
 */
export function buildCustomerRegistrationSmsMessage(registrationUrl) {
  const url = String(registrationUrl ?? '').trim()
  return [
    '안녕하세요.',
    '보험 상담 및 업무 진행을 위해 고객정보 등록 링크를 안내드립니다.',
    '',
    '아래 링크를 눌러 필요한 정보를 입력해 주세요.',
    url,
  ].join('\n')
}
