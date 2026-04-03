import { randomInt, randomUUID } from 'node:crypto'
import { parseGaId } from './lib/parseGaId.js'
import { systemQuery } from './utils/dbSafeQuery.js'
import { sendVerificationCode } from './services/smsService.js'
import { consumeSmsVerificationCode } from './services/consumeSmsVerificationCode.js'
import { runAccountResetDataOnClient } from './services/accountResetService.js'
import { assertNotVerifyLocked, recordVerifyFailure, clearVerifyFailures } from './services/smsRateLimit.js'
import { assertSmsRequestIpLimit, getClientIp, getClientUserAgent } from './services/smsRequestIpLimit.js'
import { assertNotSmsAccountLocked, recordUserSmsVerificationFailure } from './services/smsAccountLock.js'
import {
  clearUserSmsRequestQuota,
  incrementLatestSmsCodeFailures,
  insertSmsVerificationLog,
} from './services/smsVerificationAudit.js'
import { applyUserSmsRequestAfterSend, evaluateUserSmsRequestQuota } from './services/smsUserDbRate.js'
import { normalizeKrMobile, validateKrMobileDigits } from './lib/phoneNormalize.js'

const SMS_PURPOSE_PASSWORD_RESET = 'PASSWORD_RESET'
const SMS_PURPOSE_ACCOUNT_RESET = 'ACCOUNT_RESET'

function exposeSmsDebugCode(runningInProduction) {
  return (
    !runningInProduction && String(process.env.INSURANCE_SMS_DEBUG_RESPONSE_CODE ?? '').trim() === 'true'
  )
}

function logSmsEvent(label, meta) {
  console.info(`[sms-auth] ${label}`, meta)
}

function requireEndUser(req, res, next) {
  if (req.user?.role !== 'USER') {
    res.status(403).json({ message: '일반 설계사(USER) 계정만 이용할 수 있습니다.' })
    return
  }
  next()
}

async function loadActiveUserByUsername(pool, normalizedUsername) {
  const r = await systemQuery(
    pool,
    `
    SELECT id, username, phone_number, role, status, is_deleted, sms_blocked_until, ga_id
    FROM users
    WHERE username = $1 AND is_deleted = false
    `,
    [normalizedUsername],
  )
  return r.rows[0] ?? null
}

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {typeof import('bcryptjs')} ctx.bcrypt
 * @param {Function} ctx.validateCredentials (username, password) => string | null  — 재설정용 newPassword 검증 시 username 더미
 * @param {Function} ctx.handleDbError
 * @param {boolean} ctx.RUNNING_IN_PRODUCTION
 * @param {Function} ctx.requireAuth
 */
export function registerAuthAccountSmsApi(apiRouter, ctx) {
  const {
    pool,
    bcrypt,
    validateCredentials,
    handleDbError,
    RUNNING_IN_PRODUCTION,
    requireAuth,
  } = ctx

  const showDebugCode = exposeSmsDebugCode(RUNNING_IN_PRODUCTION)

  apiRouter.post('/auth/request-password-reset-code', async (req, res) => {
    const client = await pool.connect()
    try {
      const ipLimit = assertSmsRequestIpLimit(req)
      if (!ipLimit.ok) {
        res.status(429).json({ message: ipLimit.message, retryAfterSec: ipLimit.retryAfterSec })
        return
      }

      const usernameNorm = String(req.body?.username ?? '').trim()
      const phoneNorm = normalizeKrMobile(req.body?.phoneNumber ?? req.body?.phone_number)
      const phoneErr = validateKrMobileDigits(phoneNorm)
      if (phoneErr) {
        res.status(400).json({ message: phoneErr })
        return
      }
      if (!usernameNorm || usernameNorm.length < 3) {
        res.status(400).json({ message: '아이디를 입력해 주세요.' })
        return
      }

      await client.query('BEGIN')
      const lockR = await client.query(
        `
        SELECT
          id, username, phone_number, role, status, is_deleted, ga_id,
          last_sms_requested_at, sms_request_count, sms_request_window_start,
          sms_blocked_until
        FROM users
        WHERE username = $1 AND is_deleted = false
        FOR UPDATE
        `,
        [usernameNorm],
      )
      const user = lockR.rows[0]
      const okUser =
        user &&
        String(user.role ?? '').toUpperCase() === 'USER' &&
        String(user.status ?? '').toLowerCase() === 'active' &&
        normalizeKrMobile(user.phone_number) === phoneNorm

      if (!okUser) {
        await client.query('ROLLBACK')
        logSmsEvent('password_reset_request_mismatch', { username: usernameNorm })
        res.status(400).json({ message: '아이디와 등록된 휴대폰 정보가 일치하지 않습니다.' })
        return
      }

      const userGa = parseGaId(user.ga_id)
      if (userGa == null) {
        await client.query('ROLLBACK')
        res.status(500).json({ message: '계정 GA 정보가 올바르지 않습니다.' })
        return
      }

      const acctLock = assertNotSmsAccountLocked(user)
      if (!acctLock.ok) {
        await client.query('ROLLBACK')
        res
          .status(429)
          .json({
            message: acctLock.message,
            retryAfterSec: acctLock.retryAfterSec,
            retryAfterMin: acctLock.retryAfterMin,
          })
        return
      }

      const quota = evaluateUserSmsRequestQuota(user)
      if (!quota.ok) {
        await client.query('ROLLBACK')
        res.status(429).json({ message: quota.message, retryAfterSec: quota.retryAfterSec })
        return
      }

      await client.query(
        `
        UPDATE sms_verification_codes SET used = true
        WHERE purpose = $1 AND user_id = $2 AND used = false
        `,
        [SMS_PURPOSE_PASSWORD_RESET, user.id],
      )

      const code = String(randomInt(100_000, 1_000_000))
      await client.query(
        `
        INSERT INTO sms_verification_codes
          (purpose, user_id, username, phone_number, code, expires_at)
        VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '5 minutes')
        `,
        [SMS_PURPOSE_PASSWORD_RESET, user.id, usernameNorm, phoneNorm, code],
      )

      await applyUserSmsRequestAfterSend(client, user.id, quota, userGa)
      await client.query('COMMIT')

      await sendVerificationCode({
        phoneNumber: phoneNorm,
        code,
        purpose: SMS_PURPOSE_PASSWORD_RESET,
      })

      logSmsEvent('password_reset_code_issued', {
        purpose: SMS_PURPOSE_PASSWORD_RESET,
        userId: user.id,
      })

      const payload = { ok: true, message: '인증번호가 발송되었습니다. (SMS 미연동 시 문자는 수신되지 않을 수 있습니다)' }
      if (showDebugCode) {
        payload.debugCode = code
      }
      res.json(payload)
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      handleDbError(e, res)
    } finally {
      client.release()
    }
  })

  apiRouter.post('/auth/reset-password-by-sms', async (req, res) => {
    const client = await pool.connect()
    try {
      const usernameNorm = String(req.body?.username ?? '').trim()
      const phoneNorm = normalizeKrMobile(req.body?.phoneNumber ?? req.body?.phone_number)
      const codeRaw = String(req.body?.code ?? '').trim()
      const newPassword = req.body?.newPassword ?? req.body?.new_password

      const phoneErr = validateKrMobileDigits(phoneNorm)
      if (phoneErr) {
        res.status(400).json({ message: phoneErr })
        return
      }
      if (!usernameNorm) {
        res.status(400).json({ message: '아이디를 입력해 주세요.' })
        return
      }
      if (!/^\d{6}$/.test(codeRaw)) {
        res.status(400).json({ message: '인증번호 6자리를 입력해 주세요.' })
        return
      }

      const lock = assertNotVerifyLocked(SMS_PURPOSE_PASSWORD_RESET, phoneNorm, usernameNorm)
      if (!lock.ok) {
        res.status(429).json({ message: lock.message, retryAfterSec: lock.retryAfterSec })
        return
      }

      const pwdMsg = validateCredentials(usernameNorm, newPassword)
      if (pwdMsg) {
        res.status(400).json({ message: pwdMsg })
        return
      }

      const user = await loadActiveUserByUsername(pool, usernameNorm)
      const okUser =
        user &&
        String(user.role ?? '').toUpperCase() === 'USER' &&
        String(user.status ?? '').toLowerCase() === 'active' &&
        normalizeKrMobile(user.phone_number) === phoneNorm

      if (!okUser) {
        recordVerifyFailure(SMS_PURPOSE_PASSWORD_RESET, phoneNorm, usernameNorm)
        res.status(400).json({ message: '아이디와 등록된 휴대폰 정보가 일치하지 않습니다.' })
        return
      }

      const userGa = parseGaId(user.ga_id)
      if (userGa == null) {
        res.status(500).json({ message: '계정 GA 정보가 올바르지 않습니다.' })
        return
      }

      const acctLockPre = assertNotSmsAccountLocked(user)
      if (!acctLockPre.ok) {
        res.status(429).json({
          message: acctLockPre.message,
          retryAfterSec: acctLockPre.retryAfterSec,
          retryAfterMin: acctLockPre.retryAfterMin,
        })
        return
      }

      const auditIp = getClientIp(req)
      const auditUa = getClientUserAgent(req)
      const passwordHash = await bcrypt.hash(String(newPassword), 10)

      await client.query('BEGIN')
      const consumed = await consumeSmsVerificationCode(client, {
        userId: user.id,
        phoneNumber: phoneNorm,
        code: codeRaw,
        purpose: SMS_PURPOSE_PASSWORD_RESET,
        username: usernameNorm,
      })
      if (consumed.rowCount === 0) {
        await client.query('ROLLBACK')
        await incrementLatestSmsCodeFailures(pool, {
          userId: user.id,
          phoneNumber: phoneNorm,
          purpose: SMS_PURPOSE_PASSWORD_RESET,
        })
        await recordUserSmsVerificationFailure(pool, user.id, userGa)
        await insertSmsVerificationLog(pool, {
          userId: user.id,
          phoneNumber: phoneNorm,
          purpose: SMS_PURPOSE_PASSWORD_RESET,
          success: false,
          ip: auditIp,
          userAgent: auditUa,
        })
        recordVerifyFailure(SMS_PURPOSE_PASSWORD_RESET, phoneNorm, usernameNorm)
        res.status(400).json({ message: '인증번호가 올바르지 않거나 이미 사용되었습니다.' })
        return
      }

      await client.query(
        `UPDATE users SET password_hash = $1 WHERE id = $2 AND ga_id = $3 AND is_deleted = false`,
        [passwordHash, user.id, userGa],
      )
      await clearUserSmsRequestQuota(client, user.id, userGa)
      await client.query('COMMIT')

      void insertSmsVerificationLog(pool, {
        userId: user.id,
        phoneNumber: phoneNorm,
        purpose: SMS_PURPOSE_PASSWORD_RESET,
        success: true,
        ip: auditIp,
        userAgent: auditUa,
      }).catch((err) => console.error('[sms-auth] audit log failed', err))

      clearVerifyFailures(SMS_PURPOSE_PASSWORD_RESET, phoneNorm, usernameNorm)
      logSmsEvent('password_reset_complete', { userId: user.id })
      res.json({ ok: true, message: '비밀번호가 변경되었습니다.' })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      handleDbError(e, res)
    } finally {
      client.release()
    }
  })

  apiRouter.post('/account/request-reset-account-code', requireAuth, requireEndUser, async (req, res) => {
    const client = await pool.connect()
    try {
      const ipLimit = assertSmsRequestIpLimit(req)
      if (!ipLimit.ok) {
        res.status(429).json({ message: ipLimit.message, retryAfterSec: ipLimit.retryAfterSec })
        return
      }

      const userId = String(req.user?.id ?? '').trim()
      const actorGaId = parseGaId(req.user?.gaId)
      if (actorGaId == null) {
        res.status(400).json({ message: '세션 GA 정보가 올바르지 않습니다.' })
        return
      }
      const phoneNorm = normalizeKrMobile(req.body?.phoneNumber ?? req.body?.phone_number)
      const phoneErr = validateKrMobileDigits(phoneNorm)
      if (phoneErr) {
        res.status(400).json({ message: phoneErr })
        return
      }

      await client.query('BEGIN')
      const uR = await client.query(
        `
        SELECT
          id, phone_number, role, status, is_deleted,
          last_sms_requested_at, sms_request_count, sms_request_window_start,
          sms_blocked_until
        FROM users
        WHERE id = $1 AND ga_id = $2 AND is_deleted = false
        FOR UPDATE
        `,
        [userId, actorGaId],
      )
      const u = uR.rows[0]
      if (!u || String(u.role ?? '').toUpperCase() !== 'USER') {
        await client.query('ROLLBACK')
        res.status(403).json({ message: '처리할 수 없는 계정입니다.' })
        return
      }
      if (String(u.status ?? '').toLowerCase() !== 'active') {
        await client.query('ROLLBACK')
        res.status(403).json({ message: '접근이 제한된 계정입니다.' })
        return
      }
      if (normalizeKrMobile(u.phone_number) !== phoneNorm) {
        await client.query('ROLLBACK')
        res.status(400).json({ message: '계정에 등록된 휴대폰 번호와 일치하지 않습니다.' })
        return
      }

      const acctLockReq = assertNotSmsAccountLocked(u)
      if (!acctLockReq.ok) {
        await client.query('ROLLBACK')
        res.status(429).json({
          message: acctLockReq.message,
          retryAfterSec: acctLockReq.retryAfterSec,
          retryAfterMin: acctLockReq.retryAfterMin,
        })
        return
      }

      const quota = evaluateUserSmsRequestQuota(u)
      if (!quota.ok) {
        await client.query('ROLLBACK')
        res.status(429).json({ message: quota.message, retryAfterSec: quota.retryAfterSec })
        return
      }

      await client.query(
        `
        UPDATE sms_verification_codes SET used = true
        WHERE purpose = $1 AND user_id = $2 AND used = false
        `,
        [SMS_PURPOSE_ACCOUNT_RESET, userId],
      )

      const code = String(randomInt(100_000, 1_000_000))
      await client.query(
        `
        INSERT INTO sms_verification_codes
          (purpose, user_id, username, phone_number, code, expires_at)
        VALUES ($1, $2, NULL, $3, $4, NOW() + INTERVAL '5 minutes')
        `,
        [SMS_PURPOSE_ACCOUNT_RESET, userId, phoneNorm, code],
      )

      await applyUserSmsRequestAfterSend(client, userId, quota, actorGaId)
      await client.query('COMMIT')

      await sendVerificationCode({
        phoneNumber: phoneNorm,
        code,
        purpose: SMS_PURPOSE_ACCOUNT_RESET,
      })

      logSmsEvent('account_reset_code_issued', {
        purpose: SMS_PURPOSE_ACCOUNT_RESET,
        userId,
      })

      const payload = { ok: true, message: '인증번호가 발송되었습니다. (SMS 미연동 시 문자는 수신되지 않을 수 있습니다)' }
      if (showDebugCode) {
        payload.debugCode = code
      }
      res.json(payload)
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      handleDbError(e, res)
    } finally {
      client.release()
    }
  })

  apiRouter.post('/account/reset-account-by-sms', requireAuth, requireEndUser, async (req, res) => {
    const client = await pool.connect()
    try {
      const userId = String(req.user?.id ?? '').trim()
      const actorGaId = parseGaId(req.user?.gaId)
      if (actorGaId == null) {
        res.status(400).json({ message: '세션 GA 정보가 올바르지 않습니다.' })
        return
      }
      const phoneNorm = normalizeKrMobile(req.body?.phoneNumber ?? req.body?.phone_number)
      const codeRaw = String(req.body?.code ?? '').trim()
      const confirmReset = req.body?.confirmReset === true

      if (!confirmReset) {
        res.status(400).json({ message: '데이터 삭제 및 계정 초기화에 동의해야 진행할 수 있습니다.' })
        return
      }

      const phoneErr = validateKrMobileDigits(phoneNorm)
      if (phoneErr) {
        res.status(400).json({ message: phoneErr })
        return
      }
      if (!/^\d{6}$/.test(codeRaw)) {
        res.status(400).json({ message: '인증번호 6자리를 입력해 주세요.' })
        return
      }

      const lock = assertNotVerifyLocked(SMS_PURPOSE_ACCOUNT_RESET, `${phoneNorm}:${userId}`, userId)
      if (!lock.ok) {
        res.status(429).json({ message: lock.message, retryAfterSec: lock.retryAfterSec })
        return
      }

      const uR = await systemQuery(
        pool,
        `
        SELECT id, username, phone_number, role, status, sms_blocked_until
        FROM users
        WHERE id = $1 AND ga_id = $2 AND is_deleted = false
        `,
        [userId, actorGaId],
      )
      const u = uR.rows[0]
      if (!u || String(u.role ?? '').toUpperCase() !== 'USER') {
        res.status(403).json({ message: '처리할 수 없는 계정입니다.' })
        return
      }
      if (String(u.status ?? '').toLowerCase() !== 'active') {
        res.status(403).json({ message: '접근이 제한된 계정입니다.' })
        return
      }
      if (normalizeKrMobile(u.phone_number) !== phoneNorm) {
        recordVerifyFailure(SMS_PURPOSE_ACCOUNT_RESET, `${phoneNorm}:${userId}`, userId)
        res.status(400).json({ message: '계정에 등록된 휴대폰 번호와 일치하지 않습니다.' })
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

      const newUsername = `__reset_${userId.replace(/-/g, '')}`
      const randomPwdHash = await bcrypt.hash(randomUUID(), 10)
      const auditIp = getClientIp(req)
      const auditUa = getClientUserAgent(req)

      await client.query('BEGIN')
      const consumed = await consumeSmsVerificationCode(client, {
        userId,
        phoneNumber: phoneNorm,
        code: codeRaw,
        purpose: SMS_PURPOSE_ACCOUNT_RESET,
        username: null,
      })
      if (consumed.rowCount === 0) {
        await client.query('ROLLBACK')
        await incrementLatestSmsCodeFailures(pool, {
          userId,
          phoneNumber: phoneNorm,
          purpose: SMS_PURPOSE_ACCOUNT_RESET,
        })
        await recordUserSmsVerificationFailure(pool, userId, actorGaId)
        await insertSmsVerificationLog(pool, {
          userId,
          phoneNumber: phoneNorm,
          purpose: SMS_PURPOSE_ACCOUNT_RESET,
          success: false,
          ip: auditIp,
          userAgent: auditUa,
        })
        recordVerifyFailure(SMS_PURPOSE_ACCOUNT_RESET, `${phoneNorm}:${userId}`, userId)
        res.status(400).json({ message: '인증번호가 올바르지 않거나 이미 사용되었습니다.' })
        return
      }

      await runAccountResetDataOnClient(client, {
        userId,
        gaId: actorGaId,
        newUsername,
        passwordHash: randomPwdHash,
      })
      await client.query('COMMIT')

      void insertSmsVerificationLog(pool, {
        userId,
        phoneNumber: phoneNorm,
        purpose: SMS_PURPOSE_ACCOUNT_RESET,
        success: true,
        ip: auditIp,
        userAgent: auditUa,
      }).catch((err) => console.error('[sms-auth] audit log failed', err))

      clearVerifyFailures(SMS_PURPOSE_ACCOUNT_RESET, `${phoneNorm}:${userId}`, userId)
      logSmsEvent('account_reset_complete', { userId })
      res.json({
        ok: true,
        message:
          '계정이 초기화되었습니다. 고객·신청 관련 데이터가 삭제되었으며, 이 계정으로는 더 이상 로그인할 수 없습니다.',
      })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      handleDbError(e, res)
    } finally {
      client.release()
    }
  })
}
