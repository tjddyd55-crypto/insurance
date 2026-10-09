import { sendTransactionalSms } from '../services/smsService.js'

/** 인증 SMS(SIGNUP)와 분리된 transactional purpose */
export const SIGNUP_WELCOME_SMS_PURPOSE = 'SIGNUP_WELCOME'

function maskPhoneTail(phoneDigits) {
  const d = String(phoneDigits ?? '').replace(/\D/g, '')
  if (d.length < 4) {
    return '***'
  }
  return `***${d.slice(-4)}`
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function formatOnefcSupportPhoneDisplay(env = process.env) {
  const raw = String(env.ONEFC_SUPPORT_PHONE ?? env.SIGNUP_WELCOME_INQUIRY_PHONE ?? '').trim()
  if (!raw) {
    return '고객센터'
  }
  const d = raw.replace(/\D/g, '')
  if (d.length === 11) {
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  }
  if (d.length === 10) {
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  }
  return raw
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function buildSignupWelcomeSmsMessage(env = process.env) {
  const inquiry = formatOnefcSupportPhoneDisplay(env)
  return `[ONE FC]\nONE FC 가입을 환영합니다.\n사용 방법이 궁금하시거나 이용 중 문의사항이 있으시면 언제든 아래 번호로 연락해 주세요.\n문의: ${inquiry}`
}

/**
 * 가입 COMMIT 성공 후 호출. SMS 실패는 가입 응답과 결합하지 않는다.
 * @param {import('pg').Pool} pool
 * @param {{ userId: string, phoneNumber: string }} params
 */
export function queueSignupWelcomeSms(pool, { userId, phoneNumber }) {
  void sendSignupWelcomeSmsOnce(pool, { userId, phoneNumber }).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[signup-welcome-sms] unhandled', { userId: String(userId ?? ''), err: msg })
  })
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ userId: string, phoneNumber: string }} params
 */
async function sendSignupWelcomeSmsOnce(pool, { userId, phoneNumber }) {
  const uid = String(userId ?? '').trim()
  const receiver = String(phoneNumber ?? '').replace(/\D/g, '')
  if (!uid || !receiver) {
    return
  }

  const claim = await pool.query(
    `INSERT INTO signup_welcome_sms_log (user_id, phone_number, status)
     VALUES ($1, $2, 'queued')
     ON CONFLICT (user_id) DO NOTHING
     RETURNING user_id`,
    [uid, receiver]
  )
  if (claim.rowCount === 0) {
    console.info('[signup-welcome-sms] skipped duplicate', { userId: uid })
    return
  }

  console.info('[signup-welcome-sms] queued', { userId: uid, to: maskPhoneTail(receiver) })

  const message = buildSignupWelcomeSmsMessage()
  try {
    const result = await sendTransactionalSms({
      phoneNumber: receiver,
      message,
      purpose: SIGNUP_WELCOME_SMS_PURPOSE,
    })
    const status = result.success ? 'sent' : 'failed'
    await pool.query(
      `UPDATE signup_welcome_sms_log
       SET status = $2, provider = $3, updated_at = NOW()
       WHERE user_id = $1`,
      [uid, status, result.provider ? String(result.provider) : null]
    )
    if (result.success) {
      console.info('[signup-welcome-sms] sent', {
        userId: uid,
        to: maskPhoneTail(receiver),
        mocked: Boolean(result.mocked),
        test: Boolean(result.test),
      })
    } else {
      console.warn('[signup-welcome-sms] failed', {
        userId: uid,
        to: maskPhoneTail(receiver),
        reason: result.reason ?? result.errorMessage ?? result.errorCode,
      })
    }
  } catch (err) {
    await pool.query(
      `UPDATE signup_welcome_sms_log SET status = 'failed', updated_at = NOW() WHERE user_id = $1`,
      [uid]
    )
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[signup-welcome-sms] failed', { userId: uid, to: maskPhoneTail(receiver), err: msg })
  }
}
