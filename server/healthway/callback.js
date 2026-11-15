import { createHash, randomUUID } from 'node:crypto'
import { assertConfigured, failure } from './config.js'
import { deriveHealthwayKey, tokenHash } from './crypto.js'
import { certificationCase, completeOfflineFlow } from './flow.js'
import { checkLink, transaction, transition } from './repository.js'
import { verifyMockCallback } from './mockCallback.js'

export function validateResultData(resultData) {
  if (typeof resultData !== 'string' || !resultData.length || resultData.length > 16384 || /[\u0000-\u001f\u007f-\u009f]/u.test(resultData)) throw failure(400, 'invalid_input')
}

/** Only the verified request binding/case leave this function; decrypted PII is never persisted here.
 * The live branch is deliberately unreachable from the router's existing assertConfigured guard.
 */
export async function verifyCallbackResult(resultData, config, adapter) {
  validateResultData(resultData)
  if (config.offline) return verifyMockCallback(resultData, config)
  if (resultData.startsWith('MOCKCB.')) throw failure(400, 'verify_failed')
  if (!['testbed', 'production'].includes(config.provider) || !config.decryptionKey) throw failure(503, 'provider_not_configured')
  try {
    const { data: cert } = await adapter.sdk('0201', [resultData, config.decryptionKey])
    if (!cert || typeof cert.match !== 'boolean' || typeof cert.demandDealingsNo !== 'string' || !cert.demandDealingsNo.length) throw new Error()
    return { demandDealingsNo: cert.demandDealingsNo, caseCode: certificationCase(cert) }
  } catch { throw failure(400, 'verify_failed') }
}

const pages = {
  success: ['성공', '연결 완료, 창을 닫고 설계사에게 알려주세요.'],
  already_joined: ['이미 가입', '연결 완료, 창을 닫고 설계사에게 알려주세요.'],
  retry_join_failed: ['재시도 필요', '이용가입에 실패했습니다. 인증을 다시 시도해 주세요.'],
  retry_auth_failed: ['재시도 필요', '본인인증이 실패하거나 취소되었습니다. 다시 시도해 주세요.'],
}
function sendPage(res, status, outcome) {
  const [title, message] = pages[outcome] || ['처리 불가', '요청을 처리할 수 없습니다. 설계사에게 문의해 주세요.']
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff' })
  return res.status(status).type('html').send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>건강정보 연결</title><style>body{font-family:sans-serif;max-width:32rem;margin:15vh auto;padding:1.5rem;line-height:1.7}</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`)
}
function clientHash(value, config, kind) {
  try {
    return createHash('sha256').update(deriveHealthwayKey(config.tokenKey, `healthway:callback-log:${kind}:v1`)).update(String(value || '')).digest('hex')
  } catch { return null } // Misconfigured provider still gets a safe error response/log attempt.
}
async function writeLogs(pool, record) {
  const { receivedAt, outcome, caseCode, errorCode, requestId, hash, length, ipHash, agentHash, duration } = record
  const values = [receivedAt, outcome, caseCode, errorCode, requestId, hash, length, ipHash, agentHash, duration, randomUUID()]
  let rows = "($11,'access',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)"
  if (errorCode) { values.push(randomUUID()); rows += ",($12,'error',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)" }
  try {
    // One atomic insert: exactly one access row plus one error row on failure, with no raw input.
    await pool.query(`INSERT INTO healthway_callback_logs
      (id,level,received_at,outcome,case_code,error_code,request_id,result_data_sha256,result_data_length,client_ip_hash,user_agent_hash,duration_ms)
      VALUES ${rows}`, values)
  } catch { /* Logging must never change the callback response or emit DB details. */ }
}

export function createCertificationCallback({ pool, adapter, config }) {
  return async (req, res) => {
    const started = performance.now(), receivedAt = new Date()
    let resultData, caseCode = null, requestId = null, outcome = 'internal_error', errorCode = 'internal_error', status = 500
    try {
      const query = new URLSearchParams(req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '')
      resultData = query.get('resultData')
      if (req.method !== 'GET') { res.set('Allow', 'GET'); throw failure(405, 'method_not_allowed') }
      if (!config.enabled) throw failure(404, 'module_disabled')
      validateResultData(resultData)
      if (query.getAll('resultData').length !== 1) throw failure(400, 'invalid_input')
      // Preserve the module's offline-only gate, before *any* adapter call (even with a live key).
      try { assertConfigured(config) } catch { throw failure(503, 'provider_not_configured') }
      const verified = await verifyCallbackResult(resultData, config, adapter)
      caseCode = verified.caseCode
      let claimed
      await transaction(pool, async (db) => {
        const rows = (await db.query('SELECT * FROM healthway_requests WHERE demand_dealings_no=$1 FOR UPDATE', [verified.demandDealingsNo])).rows
        const row = rows.length === 1 ? rows[0] : null
        requestId = row?.id || null
        try { checkLink(row) } catch { throw failure(409, 'replay') }
        if (row.status !== 'auth_pending' || row.callback_used_at) throw failure(409, 'replay')
        if (caseCode === 'CASE1' || caseCode === 'CASE3') claimed = await transition(db, row, 'processing', { callback_used_at: new Date() })
      })
      if (claimed) await completeOfflineFlow(pool, adapter, config, claimed)
      outcome = { CASE1: 'success', CASE2: 'retry_join_failed', CASE3: 'already_joined', CASE4: 'retry_auth_failed' }[caseCode]
      errorCode = ['CASE2', 'CASE4'].includes(caseCode) ? outcome : null
      status = 200
    } catch (err) {
      // Never use untrusted SDK/DB error codes, messages or stacks in a response or log.
      const known = ['invalid_input', 'verify_failed', 'provider_not_configured', 'replay', 'method_not_allowed', 'module_disabled'].includes(err?.code)
      outcome = known ? err.code : err?.status === 409 ? 'replay' : 'internal_error'
      errorCode = outcome
      status = known ? err.status : outcome === 'replay' ? 409 : 500
    }
    const hash = typeof resultData === 'string' ? tokenHash(resultData) : null, length = typeof resultData === 'string' ? resultData.length : 0
    await writeLogs(pool, { receivedAt, outcome, caseCode, errorCode, requestId, hash, length,
      ipHash: clientHash(req.ip || req.socket?.remoteAddress, config, 'ip'), agentHash: clientHash(req.get('user-agent'), config, 'ua'),
      duration: Math.max(0, Math.round(performance.now() - started)) })
    console.log(`[healthway-callback] outcome=${outcome} case=${caseCode || '-'} len=${length} rid=${hash?.slice(0, 8) || '-'}`)
    return sendPage(res, status, outcome)
  }
}
