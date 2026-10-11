import {
  readSignupWelcomeSmsMessage,
  writeSignupWelcomeSmsMessage,
} from '../subscription/appSettings.js'
import { buildSignupWelcomeSmsMessage } from './signupWelcomeSms.js'

const SETTING_KEY = 'signup.welcome_sms_message'

function normalizeMessage(raw) {
  if (typeof raw !== 'string') return null
  const message = raw.replace(/\r\n/g, '\n').trim()
  if (!message) return null
  if (message.length > 2000) return null
  return message
}

async function loadSettingMeta(pool) {
  const { rows } = await pool.query(
    `SELECT updated_at, updated_by_user_id
     FROM app_settings
     WHERE key = $1
     LIMIT 1`,
    [SETTING_KEY],
  )
  const row = rows[0]
  return {
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
    updatedByUserId: row?.updated_by_user_id ? String(row.updated_by_user_id) : null,
  }
}

/**
 * SUPER_ADMIN 전용 가입 완료 안내문자 설정.
 * 가입 발송은 signupWelcomeSms.js의 기존 transactional 경로를 그대로 사용한다.
 */
export function registerSignupWelcomeSmsAdminApi(apiRouter, {
  pool,
  requireAuth,
  requireSuperAdmin,
}) {
  apiRouter.get(
    '/admin/settings/signup-welcome-sms',
    requireAuth,
    requireSuperAdmin,
    async (_req, res) => {
      try {
        const [customMessage, meta] = await Promise.all([
          readSignupWelcomeSmsMessage(),
          loadSettingMeta(pool),
        ])
        const defaultMessage = buildSignupWelcomeSmsMessage()
        res.json({
          ok: true,
          message: customMessage ?? defaultMessage,
          defaultMessage,
          source: customMessage ? 'custom' : 'default',
          ...meta,
        })
      } catch (error) {
        console.error('[admin/settings/signup-welcome-sms GET] 실패:', error)
        res.status(500).json({ ok: false, error: '가입 안내 문자 설정을 불러오지 못했습니다.' })
      }
    },
  )

  apiRouter.patch(
    '/admin/settings/signup-welcome-sms',
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const resetToDefault = req.body?.resetToDefault === true
        if (resetToDefault) {
          await writeSignupWelcomeSmsMessage(null, req.user?.id ?? null)
        } else {
          const message = normalizeMessage(req.body?.message)
          if (!message) {
            res.status(400).json({
              ok: false,
              error: '가입 안내 문자 내용을 입력해 주세요. 최대 2,000자까지 저장할 수 있습니다.',
            })
            return
          }
          await writeSignupWelcomeSmsMessage(message, req.user?.id ?? null)
        }

        const [customMessage, meta] = await Promise.all([
          readSignupWelcomeSmsMessage(),
          loadSettingMeta(pool),
        ])
        const defaultMessage = buildSignupWelcomeSmsMessage()
        res.json({
          ok: true,
          message: customMessage ?? defaultMessage,
          defaultMessage,
          source: customMessage ? 'custom' : 'default',
          ...meta,
        })
      } catch (error) {
        console.error('[admin/settings/signup-welcome-sms PATCH] 실패:', error)
        res.status(400).json({ ok: false, error: error?.message ?? '가입 안내 문자 저장에 실패했습니다.' })
      }
    },
  )
}
