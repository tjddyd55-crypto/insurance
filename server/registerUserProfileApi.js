import { randomInt } from 'node:crypto'
import { parseGaId } from './lib/parseGaId.js'
import { issueSignupPhoneProof, issuePhoneChangeProof, verifyPhoneChangeProof } from './lib/signupPhoneProof.js'
import { systemQuery } from './utils/dbSafeQuery.js'
import { sendVerificationCode } from './services/smsService.js'
import { consumeAnonymousSmsVerificationCode, consumeSmsVerificationCode } from './services/consumeSmsVerificationCode.js'
import {
  assertNotVerifyLocked,
  recordVerifyFailure,
  clearVerifyFailures,
  assertCanRequestSmsCode,
} from './services/smsRateLimit.js'
import { assertPhoneSms10MinLimit, recordPhoneSms10MinSend } from './services/smsPhoneWindowLimit.js'
import { assertSmsRequestIpLimit, getClientIp, getClientUserAgent } from './services/smsRequestIpLimit.js'
import { assertNotSmsAccountLocked } from './services/smsAccountLock.js'
import { insertSmsVerificationLog } from './services/smsVerificationAudit.js'
import { applyUserSmsRequestAfterSend, evaluateUserSmsRequestQuota } from './services/smsUserDbRate.js'
import { normalizeKrMobile, validateKrMobileDigits } from './lib/phoneNormalize.js'
import { logSmsVerifyFailure } from './services/smsStructuredLog.js'

const SMS_PURPOSE_SIGNUP = 'SIGNUP'
const SMS_PURPOSE_PHONE_CHANGE = 'PHONE_CHANGE'

function exposeSmsDebugCode(runningInProduction) {
  return (
    !runningInProduction && String(process.env.INSURANCE_SMS_DEBUG_RESPONSE_CODE ?? '').trim() === 'true'
  )
}

async function isPhoneUsedByActiveUser(pool, phoneDigits, excludeUserId = '') {
  const ex = String(excludeUserId ?? '').trim()
  const r = await systemQuery(
    pool,
    `
    SELECT 1 FROM users
    WHERE phone_number = $1 AND is_deleted = false
      AND ($2::text = '' OR id <> $2::text)
    LIMIT 1
    `,
    [phoneDigits, ex],
  )
  return r.rowCount > 0
}

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {string} ctx.JWT_SECRET
 * @param {Function} ctx.handleDbError
 * @param {Function} ctx.requireAuth
 * @param {boolean} ctx.RUNNING_IN_PRODUCTION
 * @param {Function} ctx.normalizeInviteCode (raw) => string
 */
export function registerUserProfileApi(apiRouter, ctx) {
  const { pool, JWT_SECRET, handleDbError, requireAuth, RUNNING_IN_PRODUCTION, normalizeInviteCode } = ctx

  const showDebugCode = exposeSmsDebugCode(RUNNING_IN_PRODUCTION)

  function requireProfileUser(req, res, next) {
    if (req.user?.role === 'INSURER_MANAGER') {
      res.status(403).json({ message: '프로필 메뉴는 GA·설계사 계정에서만 이용할 수 있습니다.' })
      return
    }
    next()
  }

  apiRouter.post('/auth/send-signup-phone-code', async (req, res) => {
    const clientIp = getClientIp(req)
    let phoneNorm = ''
    let code = ''
    let newCodeRowId
    const client = await pool.connect()
    try {
      const ipLimit = assertSmsRequestIpLimit(req)
      if (!ipLimit.ok) {
        res.status(429).json({ message: '요청이 너무 많습니다.', retryAfterSec: ipLimit.retryAfterSec })
        return
      }

      const inviteRaw = req.body?.invite_code ?? req.body?.inviteCode
      const inviteNorm = normalizeInviteCode(inviteRaw ?? '')
      if (!inviteNorm) {
        res.status(400).json({ message: 'GA 코드(초대 코드)를 입력해 주세요.' })
        return
      }

      phoneNorm = normalizeKrMobile(req.body?.phoneNumber ?? req.body?.phone_number)
      const phoneErr = validateKrMobileDigits(phoneNorm)
      if (phoneErr) {
        res.status(400).json({ message: phoneErr })
        return
      }

      const gaCheck = await systemQuery(
        pool,
        `SELECT id, status FROM ga_companies WHERE code = $1 AND is_deleted = false`,
        [inviteNorm],
      )
      if (gaCheck.rows.length === 0) {
        res.status(400).json({ message: '유효하지 않은 코드입니다' })
        return
      }
      if (String(gaCheck.rows[0].status ?? '').toLowerCase() !== 'active') {
        res.status(400).json({ message: '가입할 수 없는 GA입니다' })
        return
      }

      if (await isPhoneUsedByActiveUser(pool, phoneNorm, '')) {
        res.status(409).json({ message: '이미 가입에 사용 중인 휴대폰 번호입니다.' })
        return
      }

      const gap = assertCanRequestSmsCode(SMS_PURPOSE_SIGNUP, phoneNorm)
      if (!gap.ok) {
        res.status(429).json({ message: gap.message, retryAfterSec: gap.retryAfterSec })
        return
      }

      const burst = assertPhoneSms10MinLimit(phoneNorm)
      if (!burst.ok) {
        res.status(429).json({ message: '요청이 너무 많습니다.', retryAfterSec: burst.retryAfterSec })
        return
      }

      await client.query('BEGIN')
      await client.query(
        `
        UPDATE sms_verification_codes
        SET used = TRUE, verified_at = NOW()
        WHERE purpose = $1 AND phone_number = $2 AND user_id IS NULL AND used = FALSE
        `,
        [SMS_PURPOSE_SIGNUP, phoneNorm],
      )

      code = String(randomInt(100_000, 1_000_000))
      const ins = await client.query(
        `
        INSERT INTO sms_verification_codes
          (purpose, user_id, username, phone_number, code, expires_at)
        VALUES ($1, NULL, NULL, $2, $3, NOW() + INTERVAL '3 minutes')
        RETURNING id
        `,
        [SMS_PURPOSE_SIGNUP, phoneNorm, code],
      )
      newCodeRowId = ins.rows[0]?.id
      await client.query('COMMIT')
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      handleDbError(e, res)
      return
    } finally {
      client.release()
    }

    const smsResult = await sendVerificationCode({
      phoneNumber: phoneNorm,
      code,
      purpose: SMS_PURPOSE_SIGNUP,
      clientIp,
    })
    if (!smsResult?.success) {
      if (newCodeRowId != null) {
        await pool.query('DELETE FROM sms_verification_codes WHERE id = $1', [newCodeRowId])
      }
      res.status(503).json({ message: '인증번호를 발송할 수 없습니다. 잠시 후 다시 시도해 주세요.' })
      return
    }

    recordPhoneSms10MinSend(phoneNorm)

    const payload = { ok: true, message: '인증번호가 발송되었습니다.' }
    if (showDebugCode) {
      payload.debugCode = code
    }
    res.json(payload)
  })

  apiRouter.post('/auth/verify-signup-phone-code', async (req, res) => {
    const clientIp = getClientIp(req)
    const clientUa = getClientUserAgent(req)
    const tx = await pool.connect()
    try {
      const inviteRaw = req.body?.invite_code ?? req.body?.inviteCode
      const inviteNorm = normalizeInviteCode(inviteRaw ?? '')
      if (!inviteNorm) {
        res.status(400).json({ message: 'GA 코드(초대 코드)를 입력해 주세요.' })
        return
      }

      const phoneNorm = normalizeKrMobile(req.body?.phoneNumber ?? req.body?.phone_number)
      const phoneErr = validateKrMobileDigits(phoneNorm)
      if (phoneErr) {
        res.status(400).json({ message: phoneErr })
        return
      }
      const codeRaw = String(req.body?.code ?? '').trim()
      if (!/^\d{6}$/.test(codeRaw)) {
        res.status(400).json({ message: '인증번호 6자리를 입력해 주세요.' })
        return
      }

      const lock = assertNotVerifyLocked(SMS_PURPOSE_SIGNUP, phoneNorm, inviteNorm, clientIp)
      if (!lock.ok) {
        res.status(429).json({ message: lock.message, retryAfterSec: lock.retryAfterSec })
        return
      }

      const gaCheck = await systemQuery(
        pool,
        `SELECT id, status FROM ga_companies WHERE code = $1 AND is_deleted = false`,
        [inviteNorm],
      )
      if (gaCheck.rows.length === 0) {
        res.status(400).json({ message: '유효하지 않은 코드입니다' })
        return
      }
      if (String(gaCheck.rows[0].status ?? '').toLowerCase() !== 'active') {
        res.status(400).json({ message: '가입할 수 없는 GA입니다' })
        return
      }
      const gaId = parseGaId(gaCheck.rows[0].id)
      if (gaId == null) {
        res.status(400).json({ message: '유효하지 않은 코드입니다' })
        return
      }

      if (await isPhoneUsedByActiveUser(pool, phoneNorm, '')) {
        res.status(409).json({ message: '이미 가입에 사용 중인 휴대폰 번호입니다.' })
        return
      }

      await tx.query('BEGIN')
      const consumed = await consumeAnonymousSmsVerificationCode(tx, {
        phoneNumber: phoneNorm,
        code: codeRaw,
        purpose: SMS_PURPOSE_SIGNUP,
      })
      if (consumed.rowCount === 0) {
        await tx.query('ROLLBACK')
        recordVerifyFailure(SMS_PURPOSE_SIGNUP, phoneNorm, inviteNorm, clientIp)
        logSmsVerifyFailure({
          phone: phoneNorm,
          ip: clientIp,
          status: 'code_invalid_or_used',
          purpose: SMS_PURPOSE_SIGNUP,
        })
        void insertSmsVerificationLog(pool, {
          userId: null,
          phoneNumber: phoneNorm,
          purpose: SMS_PURPOSE_SIGNUP,
          success: false,
          ip: clientIp,
          userAgent: clientUa,
        })
        res.status(400).json({ message: '인증번호가 올바르지 않거나 만료되었습니다.' })
        return
      }

      const consumedRowId = consumed.rows[0]?.id
      if (consumedRowId != null) {
        await tx.query('DELETE FROM sms_verification_codes WHERE id = $1', [consumedRowId])
      }
      await tx.query('COMMIT')

      void insertSmsVerificationLog(pool, {
        userId: null,
        phoneNumber: phoneNorm,
        purpose: SMS_PURPOSE_SIGNUP,
        success: true,
        ip: clientIp,
        userAgent: clientUa,
      }).catch(() => {})

      clearVerifyFailures(SMS_PURPOSE_SIGNUP, phoneNorm, inviteNorm, clientIp)

      const signup_phone_proof = issueSignupPhoneProof({
        JWT_SECRET,
        phoneDigits: phoneNorm,
        inviteCodeNormalized: inviteNorm,
        gaId,
      })

      res.json({
        ok: true,
        message: '휴대폰 인증이 완료되었습니다.',
        signup_phone_proof,
      })
    } catch (e) {
      try {
        await tx.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      handleDbError(e, res)
    } finally {
      tx.release()
    }
  })

  apiRouter.get('/me', requireAuth, requireProfileUser, async (req, res) => {
    try {
      const uid = String(req.user?.id ?? '').trim()
      const r = await systemQuery(
        pool,
        `
        SELECT id, username, display_name, phone_number, role, ga_id, status
        FROM users
        WHERE id = $1 AND is_deleted = false
        `,
        [uid],
      )
      if (r.rows.length === 0) {
        res.status(404).json({ message: '사용자 정보를 찾을 수 없습니다.' })
        return
      }
      const row = r.rows[0]
      res.json({
        id: String(row.id),
        username: String(row.username ?? ''),
        display_name: String(row.display_name ?? '').trim(),
        phone_number: normalizeKrMobile(row.phone_number ?? ''),
        role: String(row.role ?? ''),
        ga_id: row.ga_id,
        status: String(row.status ?? 'active').toLowerCase(),
      })
    } catch (e) {
      handleDbError(e, res)
    }
  })

  apiRouter.patch('/me', requireAuth, requireProfileUser, async (req, res) => {
    const client = await pool.connect()
    try {
      const uid = String(req.user?.id ?? '').trim()
      const gaId = parseGaId(req.user?.gaId)
      if (!uid) {
        res.status(400).json({ message: '잘못된 요청입니다.' })
        return
      }
      if (gaId == null && req.user?.role !== 'SUPER_ADMIN') {
        res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
        return
      }

      const body = req.body ?? {}
      const hasName = Object.prototype.hasOwnProperty.call(body, 'display_name') || Object.prototype.hasOwnProperty.call(body, 'name')
      const hasPhone = Object.prototype.hasOwnProperty.call(body, 'phone_number') || Object.prototype.hasOwnProperty.call(body, 'phoneNumber')

      if (!hasName && !hasPhone) {
        res.status(400).json({ message: '수정할 항목이 없습니다.' })
        return
      }

      const uR = await systemQuery(
        pool,
        `SELECT id, phone_number, ga_id FROM users WHERE id = $1 AND is_deleted = false`,
        [uid],
      )
      if (uR.rows.length === 0) {
        res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
        return
      }
      const currentPhone = normalizeKrMobile(uR.rows[0].phone_number ?? '')
      const rowGa = parseGaId(uR.rows[0].ga_id)
      if (req.user.role !== 'SUPER_ADMIN' && rowGa !== gaId) {
        res.status(403).json({ message: '권한이 없습니다.' })
        return
      }

      let newPhone = currentPhone
      if (hasPhone) {
        newPhone = normalizeKrMobile(body.phone_number ?? body.phoneNumber)
        const pErr = validateKrMobileDigits(newPhone)
        if (pErr) {
          res.status(400).json({ message: pErr })
          return
        }
      }

      const displayNameRaw =
        body.display_name ?? body.name ?? undefined
      const displayName =
        displayNameRaw !== undefined ? String(displayNameRaw ?? '').trim() : undefined
      if (displayName !== undefined && displayName === '') {
        res.status(400).json({ message: '이름을 입력해 주세요.' })
        return
      }

      let phoneToStore = currentPhone
      if (hasPhone) {
        if (newPhone === currentPhone) {
          phoneToStore = currentPhone
        } else {
          const proofRaw = String(body.phone_change_proof ?? '').trim()
          if (!proofRaw) {
            res.status(400).json({ message: '휴대폰 번호 변경을 위해 SMS 인증을 완료해 주세요.' })
            return
          }
          let proof
          try {
            proof = verifyPhoneChangeProof(proofRaw, JWT_SECRET)
          } catch {
            res.status(400).json({ message: '휴대폰 변경 인증이 만료되었거나 유효하지 않습니다.' })
            return
          }
          if (proof.userId !== uid || proof.newPhoneDigits !== newPhone) {
            res.status(400).json({ message: '인증 정보와 변경할 번호가 일치하지 않습니다.' })
            return
          }
          if (await isPhoneUsedByActiveUser(pool, newPhone, uid)) {
            res.status(409).json({ message: '다른 계정에서 사용 중인 휴대폰 번호입니다.' })
            return
          }
          phoneToStore = newPhone
        }
      }

      const sets = []
      const vals = []
      let n = 1
      if (displayName !== undefined) {
        sets.push(`display_name = $${n++}`)
        vals.push(displayName)
      }
      if (hasPhone && phoneToStore !== currentPhone) {
        sets.push(`phone_number = $${n++}`)
        vals.push(phoneToStore)
      }

      if (sets.length === 0) {
        const cur = await systemQuery(
          pool,
          `
          SELECT id, username, display_name, phone_number, role, ga_id, status
          FROM users WHERE id = $1 AND is_deleted = false
          `,
          [uid],
        )
        const row0 = cur.rows[0]
        res.json({
          id: String(row0.id),
          username: String(row0.username ?? ''),
          display_name: String(row0.display_name ?? '').trim(),
          phone_number: normalizeKrMobile(row0.phone_number ?? ''),
          role: String(row0.role ?? ''),
          ga_id: row0.ga_id,
          status: String(row0.status ?? 'active').toLowerCase(),
        })
        return
      }

      vals.push(uid)
      const scopeGa = rowGa != null ? rowGa : gaId

      let upd
      if (req.user.role === 'SUPER_ADMIN') {
        upd = await client.query(
          `
          UPDATE users SET ${sets.join(', ')}
          WHERE id = $${n} AND is_deleted = false
          RETURNING id, username, display_name, phone_number, role, ga_id, status
          `,
          vals,
        )
      } else {
        if (scopeGa == null) {
          res.status(400).json({ message: 'GA 컨텍스트가 없습니다.' })
          return
        }
        vals.push(scopeGa)
        upd = await client.query(
          `
          UPDATE users SET ${sets.join(', ')}
          WHERE id = $${n} AND ga_id = $${n + 1} AND is_deleted = false
          RETURNING id, username, display_name, phone_number, role, ga_id, status
          `,
          vals,
        )
      }

      if (upd.rowCount === 0) {
        res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
        return
      }
      const row = upd.rows[0]
      res.json({
        id: String(row.id),
        username: String(row.username ?? ''),
        display_name: String(row.display_name ?? '').trim(),
        phone_number: normalizeKrMobile(row.phone_number ?? ''),
        role: String(row.role ?? ''),
        ga_id: row.ga_id,
        status: String(row.status ?? 'active').toLowerCase(),
      })
    } catch (e) {
      handleDbError(e, res)
    } finally {
      client.release()
    }
  })

  apiRouter.post('/me/send-phone-change-code', requireAuth, requireProfileUser, async (req, res) => {
    const clientIp = getClientIp(req)
    const client = await pool.connect()
    let phoneNorm = ''
    let code = ''
    let newCodeRowId
    let userId = ''
    let actorGaId
    let quota
    try {
      const ipLimit = assertSmsRequestIpLimit(req)
      if (!ipLimit.ok) {
        res.status(429).json({ message: '요청이 너무 많습니다.', retryAfterSec: ipLimit.retryAfterSec })
        return
      }

      userId = String(req.user?.id ?? '').trim()
      actorGaId = parseGaId(req.user?.gaId)
      if (actorGaId == null && req.user?.role !== 'SUPER_ADMIN') {
        res.status(400).json({ message: '세션 GA 정보가 올바르지 않습니다.' })
        return
      }

      phoneNorm = normalizeKrMobile(req.body?.phoneNumber ?? req.body?.phone_number)
      const phoneErr = validateKrMobileDigits(phoneNorm)
      if (phoneErr) {
        res.status(400).json({ message: phoneErr })
        return
      }

      const burst = assertPhoneSms10MinLimit(phoneNorm)
      if (!burst.ok) {
        res.status(429).json({ message: '요청이 너무 많습니다.', retryAfterSec: burst.retryAfterSec })
        return
      }

      await client.query('BEGIN')
      const lockSql =
        req.user.role === 'SUPER_ADMIN'
          ? `SELECT id, phone_number, role, status, is_deleted, ga_id,
            last_sms_requested_at, sms_request_count, sms_request_window_start, sms_blocked_until
            FROM users WHERE id = $1 AND is_deleted = false FOR UPDATE`
          : `SELECT id, phone_number, role, status, is_deleted, ga_id,
            last_sms_requested_at, sms_request_count, sms_request_window_start, sms_blocked_until
            FROM users WHERE id = $1 AND ga_id = $2 AND is_deleted = false FOR UPDATE`
      const lockParams = req.user.role === 'SUPER_ADMIN' ? [userId] : [userId, actorGaId]
      const uR = await client.query(lockSql, lockParams)
      const u = uR.rows[0]
      if (!u) {
        await client.query('ROLLBACK')
        res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
        return
      }
      const currentP = normalizeKrMobile(u.phone_number ?? '')
      if (currentP === phoneNorm) {
        await client.query('ROLLBACK')
        res.status(400).json({ message: '현재 번호와 동일합니다. 다른 번호를 입력해 주세요.' })
        return
      }
      if (await isPhoneUsedByActiveUser(pool, phoneNorm, userId)) {
        await client.query('ROLLBACK')
        res.status(409).json({ message: '다른 계정에서 사용 중인 휴대폰 번호입니다.' })
        return
      }

      const acctLock = assertNotSmsAccountLocked(u)
      if (!acctLock.ok) {
        await client.query('ROLLBACK')
        res.status(429).json({
          message: acctLock.message,
          retryAfterSec: acctLock.retryAfterSec,
          retryAfterMin: acctLock.retryAfterMin,
        })
        return
      }

      quota = evaluateUserSmsRequestQuota(u)
      if (!quota.ok) {
        await client.query('ROLLBACK')
        res.status(429).json({ message: quota.message, retryAfterSec: quota.retryAfterSec })
        return
      }

      await client.query(
        `
        UPDATE sms_verification_codes SET used = TRUE, verified_at = NOW()
        WHERE purpose = $1 AND user_id = $2 AND used = FALSE
        `,
        [SMS_PURPOSE_PHONE_CHANGE, userId],
      )

      code = String(randomInt(100_000, 1_000_000))
      const ins = await client.query(
        `
        INSERT INTO sms_verification_codes
          (purpose, user_id, username, phone_number, code, expires_at)
        VALUES ($1, $2, NULL, $3, $4, NOW() + INTERVAL '3 minutes')
        RETURNING id
        `,
        [SMS_PURPOSE_PHONE_CHANGE, userId, phoneNorm, code],
      )
      newCodeRowId = ins.rows[0]?.id
      await client.query('COMMIT')
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      handleDbError(e, res)
      return
    } finally {
      client.release()
    }

    const smsOk = await sendVerificationCode({
      phoneNumber: phoneNorm,
      code,
      purpose: SMS_PURPOSE_PHONE_CHANGE,
      clientIp,
    })
    if (!smsOk?.success) {
      if (newCodeRowId != null) {
        await pool.query('DELETE FROM sms_verification_codes WHERE id = $1', [newCodeRowId])
      }
      res.status(503).json({ message: '인증번호를 발송할 수 없습니다. 잠시 후 다시 시도해 주세요.' })
      return
    }

    recordPhoneSms10MinSend(phoneNorm)

    const quotaClient = await pool.connect()
    try {
      const gaRow = await systemQuery(pool, `SELECT ga_id FROM users WHERE id = $1`, [userId])
      const gIdForQuota = actorGaId ?? parseGaId(gaRow.rows[0]?.ga_id)
      if (gIdForQuota != null) {
        await quotaClient.query('BEGIN')
        await applyUserSmsRequestAfterSend(quotaClient, userId, quota, gIdForQuota)
        await quotaClient.query('COMMIT')
      }
    } catch (eq) {
      try {
        await quotaClient.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      console.error('[profile] phone-change quota after SMS failed', eq)
    } finally {
      quotaClient.release()
    }

    const payload = { ok: true, message: '인증번호가 발송되었습니다.' }
    if (showDebugCode) {
      payload.debugCode = code
    }
    res.json(payload)
  })

  apiRouter.post('/me/verify-phone-change-code', requireAuth, requireProfileUser, async (req, res) => {
    const clientIp = getClientIp(req)
    const clientUa = getClientUserAgent(req)
    const tx = await pool.connect()
    try {
      const userId = String(req.user?.id ?? '').trim()
      const actorGaId = parseGaId(req.user?.gaId)
      if (req.user?.role !== 'SUPER_ADMIN' && actorGaId == null) {
        res.status(400).json({ message: '세션 GA 정보가 올바르지 않습니다.' })
        return
      }

      const phoneNorm = normalizeKrMobile(req.body?.phoneNumber ?? req.body?.phone_number)
      const codeRaw = String(req.body?.code ?? '').trim()
      const phoneErr = validateKrMobileDigits(phoneNorm)
      if (phoneErr) {
        res.status(400).json({ message: phoneErr })
        return
      }
      if (!/^\d{6}$/.test(codeRaw)) {
        res.status(400).json({ message: '인증번호 6자리를 입력해 주세요.' })
        return
      }

      const lock = assertNotVerifyLocked(SMS_PURPOSE_PHONE_CHANGE, `${phoneNorm}:${userId}`, userId, clientIp)
      if (!lock.ok) {
        res.status(429).json({ message: lock.message, retryAfterSec: lock.retryAfterSec })
        return
      }

      const uR = await systemQuery(
        pool,
        `
        SELECT id, phone_number, ga_id, role, status, is_deleted, sms_blocked_until
        FROM users
        WHERE id = $1 AND is_deleted = false
        `,
        [userId],
      )
      const u = uR.rows[0]
      if (!u) {
        res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
        return
      }
      const uGa = parseGaId(u.ga_id)
      if (req.user.role !== 'SUPER_ADMIN' && uGa !== actorGaId) {
        res.status(403).json({ message: '권한이 없습니다.' })
        return
      }
      if (normalizeKrMobile(u.phone_number ?? '') === phoneNorm) {
        res.status(400).json({ message: '현재 번호와 동일합니다.' })
        return
      }
      if (await isPhoneUsedByActiveUser(pool, phoneNorm, userId)) {
        res.status(409).json({ message: '다른 계정에서 사용 중인 휴대폰 번호입니다.' })
        return
      }

      const acctLockPre = assertNotSmsAccountLocked(u)
      if (!acctLockPre.ok) {
        res.status(429).json({
          message: acctLockPre.message,
          retryAfterSec: acctLockPre.retryAfterSec,
          retryAfterMin: acctLockPre.retryAfterMin,
        })
        return
      }

      await tx.query('BEGIN')
      const consumed = await consumeSmsVerificationCode(tx, {
        userId,
        phoneNumber: phoneNorm,
        code: codeRaw,
        purpose: SMS_PURPOSE_PHONE_CHANGE,
        username: null,
      })
      if (consumed.rowCount === 0) {
        await tx.query('ROLLBACK')
        recordVerifyFailure(SMS_PURPOSE_PHONE_CHANGE, `${phoneNorm}:${userId}`, userId, clientIp)
        logSmsVerifyFailure({
          phone: phoneNorm,
          ip: clientIp,
          status: 'code_invalid_or_used',
          purpose: SMS_PURPOSE_PHONE_CHANGE,
        })
        res.status(400).json({ message: '인증번호가 올바르지 않거나 만료되었습니다.' })
        return
      }

      const consumedRowId = consumed.rows[0]?.id
      if (consumedRowId != null) {
        await tx.query('DELETE FROM sms_verification_codes WHERE id = $1', [consumedRowId])
      }
      await tx.query('COMMIT')

      void insertSmsVerificationLog(pool, {
        userId,
        phoneNumber: phoneNorm,
        purpose: SMS_PURPOSE_PHONE_CHANGE,
        success: true,
        ip: clientIp,
        userAgent: clientUa,
      }).catch(() => {})

      clearVerifyFailures(SMS_PURPOSE_PHONE_CHANGE, `${phoneNorm}:${userId}`, userId, clientIp)

      const phone_change_proof = issuePhoneChangeProof({
        JWT_SECRET,
        userId,
        newPhoneDigits: phoneNorm,
      })

      res.json({
        ok: true,
        message: '휴대폰 인증이 완료되었습니다. 변경 저장을 진행해 주세요.',
        phone_change_proof,
      })
    } catch (e) {
      try {
        await tx.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      handleDbError(e, res)
    } finally {
      tx.release()
    }
  })
}
