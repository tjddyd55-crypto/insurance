import { createHash, randomUUID } from 'node:crypto'
import { systemQuery } from '../utils/dbSafeQuery.js'
import { logSecurityEvent } from '../lib/securityAudit.js'
import { getClientIp } from '../services/smsRequestIpLimit.js'
import {
  normalizeMessageForHash,
  validatePublicInquiryBody,
} from './publicInquiryValidation.js'

const SOURCE_INTRODUCTION = 'INTRODUCTION'
const DEDUPE_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 8

const RATE_LIMIT_MESSAGE = '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
const INTERNAL_MESSAGE = '문의 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.'

/** @type {Map<string, { windowStart: number, count: number }>} */
const inquiryRateStore = new Map()

/**
 * @param {string} keyHash
 * @returns {{ ok: true } | { ok: false }}
 */
function assertInquiryRateLimit(keyHash) {
  const now = Date.now()
  let entry = inquiryRateStore.get(keyHash)
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    entry = { windowStart: now, count: 0 }
    inquiryRateStore.set(keyHash, entry)
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { ok: false }
  }
  entry.count += 1
  return { ok: true }
}

/**
 * @param {string} ip
 */
function rateLimitKeyHash(ip) {
  return createHash('sha256').update(`${ip}:inquiry`, 'utf8').digest('hex')
}

/**
 * @param {unknown} message
 */
function messageHashOf(message) {
  return createHash('sha256').update(normalizeMessageForHash(message), 'utf8').digest('hex')
}

/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string} code
 * @param {string} message
 */
function jsonError(res, status, code, message) {
  res.status(status).json({
    success: false,
    error: { code, message },
    message,
  })
}

/**
 * @param {import('express').Response} res
 * @param {{ inquiryId: string, createdAt: string | Date }} data
 */
function jsonSuccess(res, data) {
  const createdAt =
    data.createdAt instanceof Date ? data.createdAt.toISOString() : String(data.createdAt)
  res.status(200).json({
    success: true,
    data: {
      inquiryId: String(data.inquiryId),
      createdAt,
    },
  })
}

/**
 * @param {import('express').Router} apiRouter
 * @param {object} ctx
 * @param {import('pg').Pool} ctx.pool
 * @param {Function} ctx.handleDbError
 */
export function registerPublicInquiryApi(apiRouter, ctx) {
  const { pool, handleDbError } = ctx

  apiRouter.post('/public/inquiries', async (req, res) => {
    try {
      const ip = getClientIp(req)
      const rateKey = rateLimitKeyHash(ip)
      const rate = assertInquiryRateLimit(rateKey)
      if (!rate.ok) {
        jsonError(res, 429, 'RATE_LIMITED', RATE_LIMIT_MESSAGE)
        return
      }

      const validated = validatePublicInquiryBody(req.body)
      if (!validated.ok) {
        jsonError(res, 400, validated.code, validated.message)
        return
      }

      const { value } = validated

      // Honeypot: 값이 있으면 삽입 없이 성공처럼 응답 (봇에게 힌트 주지 않음)
      if (value.companyWebsite) {
        jsonSuccess(res, {
          inquiryId: randomUUID(),
          createdAt: new Date().toISOString(),
        })
        return
      }

      const messageHash = messageHashOf(value.message)
      const dedupeSince = new Date(Date.now() - DEDUPE_WINDOW_MS)

      const existing = await systemQuery(
        pool,
        `
        SELECT id, created_at
        FROM public_service_inquiries
        WHERE phone_normalized = $1
          AND inquiry_type = $2
          AND message_hash = $3
          AND source = $4
          AND deleted_at IS NULL
          AND created_at >= $5
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [value.phoneNormalized, value.inquiryType, messageHash, SOURCE_INTRODUCTION, dedupeSince],
      )

      if (existing.rows[0]) {
        jsonSuccess(res, {
          inquiryId: existing.rows[0].id,
          createdAt: existing.rows[0].created_at,
        })
        return
      }

      const privacyConsentAt = new Date()
      const inserted = await systemQuery(
        pool,
        `
        INSERT INTO public_service_inquiries (
          inquiry_type,
          name,
          phone_normalized,
          phone_display,
          organization_name,
          email,
          preferred_contact_time,
          message,
          message_hash,
          privacy_consent,
          privacy_consent_at,
          status,
          source
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, 'NEW', $11
        )
        RETURNING id, created_at
        `,
        [
          value.inquiryType,
          value.name,
          value.phoneNormalized,
          value.phoneDisplay,
          value.organizationName,
          value.email,
          value.preferredContactTime,
          value.message,
          messageHash,
          privacyConsentAt,
          SOURCE_INTRODUCTION,
        ],
      )

      const row = inserted.rows[0]
      if (!row?.id) {
        jsonError(res, 500, 'INTERNAL_ERROR', INTERNAL_MESSAGE)
        return
      }

      // PII(message/phone/email) 없이 감사만. 실패해도 요청은 성공 처리.
      void logSecurityEvent(pool, {
        actorUserId: 'anonymous',
        actorRole: 'public',
        action: 'public_inquiry_created',
        targetType: 'public_service_inquiry',
        targetId: String(row.id),
        meta: {
          inquiryType: value.inquiryType,
          source: SOURCE_INTRODUCTION,
        },
      })

      jsonSuccess(res, {
        inquiryId: row.id,
        createdAt: row.created_at,
      })
    } catch (error) {
      const code = error && typeof error === 'object' ? error.code : null
      // 42P01 = undefined_table — ensure 실패 시 silent 500 대신 표준 코드
      if (code === '42P01') {
        console.error('[public-inquiry] schema unavailable', {
          code,
          requestId: req.requestId || req.headers['x-request-id'] || null,
        })
        if (!res.headersSent) {
          jsonError(
            res,
            503,
            'INQUIRY_SCHEMA_UNAVAILABLE',
            '문의 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
          )
        }
        return
      }
      if (typeof handleDbError === 'function') {
        handleDbError(error, req, res)
      }
      if (!res.headersSent) {
        jsonError(res, 500, 'INTERNAL_ERROR', INTERNAL_MESSAGE)
      }
    }
  })
}
