import { randomUUID } from 'node:crypto'
import { forceHttpsPublicUrl } from './alimtalkPublicUrl.js'

/**
 * 고객앱 연결용 https URL — customerClaimAppApi 와 동일 규칙.
 * 알림톡 승인 템플릿 버튼은 https 고정이므로 공개 URL 은 https 로 정규화한다.
 * @param {{ protocol?: string, host?: string } | null | undefined} reqLike
 * @param {string} linkCode
 * @param {NodeJS.ProcessEnv} [env]
 */
export function buildCustomerAppUniversalLinkOpenUrl(reqLike, linkCode, env = process.env) {
  const envPage = String(env.CUSTOMER_APP_LINK_PAGE_BASE ?? '').trim()
  const legacy = String(env.CUSTOMER_APP_UNIVERSAL_BASE ?? '')
    .trim()
    .replace(/\/customer-app\/connect\/?$/i, '/customer-app/link')
  const protocol = String(reqLike?.protocol ?? 'https').replace(/:$/, '')
  const host = String(reqLike?.host ?? '').trim()
  const fallback = host ? `${protocol}://${host}/customer-app/link` : 'https://localhost/customer-app/link'
  const base = (envPage || legacy || fallback).replace(/\/+$/, '')
  const url = `${base}?code=${encodeURIComponent(String(linkCode))}`
  return forceHttpsPublicUrl(url)
}

function generateLinkCode() {
  return randomUUID().replace(/-/g, '').slice(0, 18).toUpperCase()
}

/**
 * 기존 활성 링크 재사용, 없으면 생성 (customer_app_links 동일 테이블).
 * @param {import('pg').Pool | { query: Function }} pool
 * @param {{
 *   agentId: string,
 *   customerId: number,
 *   reqLike?: { protocol?: string, host?: string } | null,
 *   env?: NodeJS.ProcessEnv,
 * }} params
 */
export async function ensureCustomerAppUniversalUrl(pool, params) {
  const agentId = String(params.agentId ?? '').trim()
  const customerId = Number(params.customerId)
  if (!agentId || !Number.isInteger(customerId) || customerId < 1) {
    return { ok: false, error: 'invalid_customer_or_agent', customerAppUrl: null, linkCode: null }
  }

  const existing = await pool.query(
    `
    SELECT id, link_code, status, expires_at
    FROM customer_app_links
    WHERE agent_id = $1
      AND customer_id = $2
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [agentId, customerId],
  )

  let linkCode = existing.rows[0] ? String(existing.rows[0].link_code) : ''

  if (!linkCode) {
    let created = null
    let tries = 0
    while (tries < 5 && !created) {
      tries += 1
      const code = generateLinkCode()
      try {
        const insert = await pool.query(
          `
          INSERT INTO customer_app_links
            (agent_id, customer_id, link_code, status, created_by_user_id, created_at, updated_at)
          VALUES ($1, $2, $3, 'active', $4, NOW(), NOW())
          RETURNING id, link_code
          `,
          [agentId, customerId, code, agentId],
        )
        created = insert.rows[0]
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
          continue
        }
        throw error
      }
    }
    if (!created) {
      return { ok: false, error: 'link_create_failed', customerAppUrl: null, linkCode: null }
    }
    linkCode = String(created.link_code)
  }

  const customerAppUrl = buildCustomerAppUniversalLinkOpenUrl(params.reqLike, linkCode, params.env)
  if (!customerAppUrl) {
    return { ok: false, error: 'url_build_failed', customerAppUrl: null, linkCode }
  }
  return { ok: true, error: null, customerAppUrl, linkCode }
}

