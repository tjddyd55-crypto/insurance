/**
 * 요청 → 접속 컨텍스트 (telemetry 전용, 인증·권한 판단 사용 금지).
 * 다른 auth 코드는 헤더/UA 를 각자 파싱하지 말고 이 함수만 사용한다.
 */
import { resolveClientContextFromHeaders } from '../../shared/clientAccessContext.js'

/** 기존 authSessions.clientIp 와 동일 규칙 (x-forwarded-for 첫 값 → socket). */
export function resolveRequestIp(req) {
  const fwd = req?.headers?.['x-forwarded-for']
  const fromFwd = typeof fwd === 'string' && fwd.trim() ? fwd.split(',')[0].trim() : ''
  if (fromFwd) return fromFwd.slice(0, 128)
  const rip = req?.socket?.remoteAddress
  return typeof rip === 'string' ? rip.slice(0, 128) : ''
}

/**
 * @param {import('express').Request} req
 * @returns {{ clientType: string | null, platform: string | null, deviceModel: string | null, appVersion: string | null, userAgent: string | null, ip: string }}
 */
export function resolveClientContext(req) {
  return { ...resolveClientContextFromHeaders(req?.headers), ip: resolveRequestIp(req) }
}
