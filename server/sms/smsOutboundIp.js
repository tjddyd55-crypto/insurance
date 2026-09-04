/**
 * CRM Aligo 발송 서버 IP 표시용 SSOT.
 * Aligo ACL 은 서버측 허용 목록 — 요청 payload 로 IP 를 보내지 않는다.
 * env 는 쉼표/공백/세미콜론/줄바꿈 구분 다중 IP 를 허용한다.
 */

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/

/**
 * @param {string | null | undefined} raw
 * @returns {string[]}
 */
export function parseSmsOutboundIpList(raw) {
  const text = String(raw ?? '').trim()
  if (!text) {
    return []
  }
  const seen = new Set()
  /** @type {string[]} */
  const out = []
  for (const part of text.split(/[\s,;|]+/)) {
    const ip = String(part ?? '').trim()
    if (!ip || !IPV4_RE.test(ip)) {
      continue
    }
    if (seen.has(ip)) {
      continue
    }
    seen.add(ip)
    out.push(ip)
  }
  return out
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string[]}
 */
export function getSmsOutboundServerIpList(env = process.env) {
  return parseSmsOutboundIpList(
    env.SMS_MODULE_OUTBOUND_IP_HINT ?? env.SMS_OUTBOUND_IP_HINT ?? '',
  )
}

/**
 * 하위 호환: 단일 문자열(쉼표 구분). UI/API 는 배열을 우선한다.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function getSmsOutboundServerIpHint(env = process.env) {
  return getSmsOutboundServerIpList(env).join(', ')
}
