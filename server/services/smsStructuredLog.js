/**
 * SMS 발송·인증 시도 관측 로그 (민감값·URL·API 키 미포함).
 */

import { insuranceLog } from '../lib/logger.js'

const deliveryLog = insuranceLog.child({ domain: 'sms-delivery' })
const verifyLog = insuranceLog.child({ domain: 'sms-verify' })
const cleanupLog = insuranceLog.child({ domain: 'sms-cleanup' })

export function maskPhoneForLog(phoneDigits) {
  const d = String(phoneDigits ?? '').replace(/\D/g, '')
  if (d.length < 4) {
    return '***'
  }
  return `***${d.slice(-4)}`
}

/**
 * @param {{ phone: string, ip: string, status: string, purpose: string, channel?: string }} p
 */
export function logSmsDelivery(p) {
  deliveryLog.info({
    phone: maskPhoneForLog(p.phone),
    ip: String(p.ip ?? '').slice(0, 64),
    status: String(p.status),
    purpose: String(p.purpose ?? ''),
    channel: p.channel ? String(p.channel) : undefined,
    timestamp: new Date().toISOString(),
  })
}

/**
 * 인증코드 검증 실패 등
 * @param {{ phone: string, ip: string, status: string, purpose: string }} p
 */
export function logSmsVerifyFailure(p) {
  verifyLog.info({
    phone: maskPhoneForLog(p.phone),
    ip: String(p.ip ?? '').slice(0, 64),
    status: String(p.status),
    purpose: String(p.purpose ?? ''),
    timestamp: new Date().toISOString(),
  })
}

export function logExpiredSmsCodesPurged(deletedCount) {
  cleanupLog.info({
    deleted: deletedCount,
    timestamp: new Date().toISOString(),
  })
}
