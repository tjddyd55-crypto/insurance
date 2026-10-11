/**
 * SUPER_ADMIN — 가입 안내 문자(SIGNUP_WELCOME) 문구 설정
 */

import { buildSignupWelcomeSmsMessage } from './signupWelcomeSms.js'
import {
  readSignupWelcomeSmsMessage,
  readSignupWelcomeSmsMessageCustomMeta,
  writeSignupWelcomeSmsMessage,
} from '../subscription/appSettings.js'

const MAX_LEN = 2000

/**
 * @param {unknown} body
 */
export function parseSignupWelcomeSmsPatchBody(body) {
  if (body === null || typeof body !== 'object') {
    return { kind: 'invalid' }
  }
  const src = /** @type {Record<string, unknown>} */ (body)
  if (src.resetToDefault === true) {
    return { kind: 'reset' }
  }
  if (typeof src.message === 'string') {
    return { kind: 'save', message: src.message }
  }
  return { kind: 'invalid' }
}

/**
 * @param {import('express').Router} apiRouter
 * @param {{
 *   requireAuth: import('express').RequestHandler,
 *   requireSuperAdmin: import('express').RequestHandler,
 * }} deps
 */
export function registerSignupWelcomeSmsAdminApi(apiRouter, deps) {
  const { requireAuth, requireSuperAdmin } = deps

  apiRouter.get(
    '/admin/settings/signup-welcome-sms',
    requireAuth,
    requireSuperAdmin,
    async (_req, res) => {
      try {
        const defaultMessage = buildSignupWelcomeSmsMessage()
        const customMeta = await readSignupWelcomeSmsMessageCustomMeta()
        const effective = (await readSignupWelcomeSmsMessage()) ?? defaultMessage
        const source = customMeta ? 'custom' : 'default'
        res.json({
          ok: true,
          message: effective,
          defaultMessage,
          source,
          updatedAt: customMeta?.updatedAt ?? null,
          updatedByUserId: customMeta?.updatedByUserId ?? null,
        })
      } catch (error) {
        console.error('[signup-welcome-sms-admin] GET 실패:', error)
        res.status(500).json({ ok: false, message: '가입 안내 문자 설정을 불러오지 못했습니다.' })
      }
    },
  )

  apiRouter.patch(
    '/admin/settings/signup-welcome-sms',
    requireAuth,
    requireSuperAdmin,
    async (req, res) => {
      try {
        const parsed = parseSignupWelcomeSmsPatchBody(req.body)
        const actorUserId = req.user?.id != null ? String(req.user.id) : null

        if (parsed.kind === 'invalid') {
          res.status(400).json({ ok: false, message: '요청 형식이 올바르지 않습니다.' })
          return
        }

        if (parsed.kind === 'reset') {
          await writeSignupWelcomeSmsMessage(null, actorUserId)
          const defaultMessage = buildSignupWelcomeSmsMessage()
          res.json({
            ok: true,
            message: defaultMessage,
            defaultMessage,
            source: 'default',
            updatedAt: null,
            updatedByUserId: null,
          })
          return
        }

        const text = parsed.message
        if (!text.trim()) {
          res.status(400).json({ ok: false, message: '문자 내용을 입력해 주세요.' })
          return
        }
        if (text.length > MAX_LEN) {
          res.status(400).json({
            ok: false,
            message: `문자 내용은 ${MAX_LEN}자 이하로 입력해 주세요.`,
          })
          return
        }

        await writeSignupWelcomeSmsMessage(text, actorUserId)
        const customMeta = await readSignupWelcomeSmsMessageCustomMeta()
        res.json({
          ok: true,
          message: text,
          defaultMessage: buildSignupWelcomeSmsMessage(),
          source: 'custom',
          updatedAt: customMeta?.updatedAt ?? null,
          updatedByUserId: customMeta?.updatedByUserId ?? null,
        })
      } catch (error) {
        const httpStatus = error && typeof error === 'object' && 'httpStatus' in error ? error.httpStatus : 500
        const message =
          error instanceof Error ? error.message : '가입 안내 문자 설정 저장에 실패했습니다.'
        if (httpStatus === 400) {
          res.status(400).json({ ok: false, message })
          return
        }
        console.error('[signup-welcome-sms-admin] PATCH 실패:', error)
        res.status(500).json({ ok: false, message: '가입 안내 문자 설정 저장에 실패했습니다.' })
      }
    },
  )
}
